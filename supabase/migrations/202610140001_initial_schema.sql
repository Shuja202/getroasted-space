create table public.posts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('text', 'image')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  image_path text,
  status text not null default 'active' check (status in ('active', 'flagged', 'removed')),
  created_at timestamptz not null default now(),
  constraint posts_image_kind_check check (
    (kind = 'image' and image_path is not null) or
    (kind = 'text' and image_path is null)
  )
);

create table public.roasts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'flagged', 'removed')),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'roast')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment', 'hate', 'explicit', 'spam', 'other')),
  reporter_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.public_action_events (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  action text not null check (action in ('roast', 'report')),
  target_id uuid not null,
  created_at timestamptz not null default now()
);
create index public_action_events_rate_idx on public.public_action_events (ip_hash, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);

alter table public.posts enable row level security;
alter table public.roasts enable row level security;
alter table public.reports enable row level security;
alter table public.public_action_events enable row level security;

revoke all on table public.posts, public.roasts, public.reports, public.public_action_events
  from public, anon, authenticated;

create or replace function public.is_verified_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
  );
$$;

revoke all on function public.is_verified_user() from public;
grant execute on function public.is_verified_user() to authenticated;

create policy "Public posts and owners can read posts"
  on public.posts for select to anon, authenticated
  using (status = 'active' or (select auth.uid()) = user_id);
create policy "Verified users can create posts"
  on public.posts for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_verified_user()));
create policy "Owners can delete posts"
  on public.posts for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select (id, kind, body, image_path, status, created_at) on public.posts to anon, authenticated;
grant select (id, status) on public.posts to service_role;
grant insert (id, user_id, kind, body, image_path) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy "Public can read visible roast content"
  on public.roasts for select to anon, authenticated
  using (status = 'visible');
grant select (id, post_id, body, status, created_at) on public.roasts to anon, authenticated;
grant select (id, status) on public.roasts to service_role;
grant insert (post_id, body) on public.roasts to service_role;

create or replace function public.get_my_posts()
returns table (id uuid, kind text, body text, image_path text, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, p.body, p.image_path, p.status, p.created_at
  from public.posts p
  where p.user_id = (select auth.uid())
  order by p.created_at desc;
$$;
revoke all on function public.get_my_posts() from public;
grant execute on function public.get_my_posts() to authenticated;

create or replace function public.consume_public_action(p_ip_hash text, p_action text, p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := now();
begin
  if p_action not in ('roast', 'report') or p_ip_hash = '' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  if (
    select count(*) from public.public_action_events e
    where e.ip_hash = p_ip_hash and e.created_at > now_at - interval '10 minutes'
  ) >= 8 then
    return false;
  end if;

  if exists (
    select 1 from public.public_action_events e
    where e.ip_hash = p_ip_hash and e.action = p_action and e.target_id = p_target_id
      and e.created_at > now_at - interval '60 seconds'
  ) then
    return false;
  end if;

  insert into public.public_action_events (ip_hash, action, target_id)
  values (p_ip_hash, p_action, p_target_id);

  delete from public.public_action_events where created_at < now_at - interval '24 hours';
  return true;
end;
$$;
revoke all on function public.consume_public_action(text, text, uuid) from public, anon, authenticated;
grant execute on function public.consume_public_action(text, text, uuid) to service_role;

create or replace function public.record_report(p_target_type text, p_target_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_count integer;
begin
  if p_target_type = 'post' then
    perform 1 from public.posts p where p.id = p_target_id for update;
    if not found then
      raise exception 'Post report target no longer exists';
    end if;
    insert into public.reports (target_type, target_id, reason) values ('post', p_target_id, p_reason);
    select count(*) into report_count from public.reports r
      where r.target_type = 'post' and r.target_id = p_target_id;
    if report_count >= 3 then
      update public.posts set status = 'flagged' where id = p_target_id and status = 'active';
    end if;
  elsif p_target_type = 'roast' then
    perform 1 from public.roasts r where r.id = p_target_id for update;
    if not found then
      raise exception 'Roast report target no longer exists';
    end if;
    insert into public.reports (target_type, target_id, reason) values ('roast', p_target_id, p_reason);
    select count(*) into report_count from public.reports r
      where r.target_type = 'roast' and r.target_id = p_target_id;
    if report_count >= 3 then
      update public.roasts set status = 'flagged' where id = p_target_id and status = 'visible';
    end if;
  else
    raise exception 'Invalid report target';
  end if;
end;
$$;
revoke all on function public.record_report(text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_report(text, uuid, text) to service_role;

create view public.public_roasts
with (security_invoker = true)
as
  select id, post_id, body, created_at
  from public.roasts
  where status = 'visible';
revoke all on public.public_roasts from public, anon, authenticated;
grant select on public.public_roasts to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('getroasted-images', 'getroasted-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Verified owners can upload post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'getroasted-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_verified_user())
  );
create policy "Owners can delete their post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'getroasted-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
