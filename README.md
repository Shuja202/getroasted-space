# GetRoasted.space

GetRoasted is a shareable roast-post app: verified users publish a text or image, then anyone with its link can leave an anonymous roast. The Expo app targets web and Android and keeps iOS builds viable.

## Stack

- Expo, React Native, and Expo Router
- Supabase Auth, Postgres, Storage, and an Edge Function
- Netlify for the static web export

## Run locally

1. Install Node.js 20 or newer and the Expo tooling (`npm install`).
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from **Supabase → Project Settings → API**. Set `EXPO_PUBLIC_SITE_URL` to the final website origin for correct Android share links.
3. Follow **Supabase setup** below, then run `npx expo start`. Press `w` for web or `a` for Android (Android Studio/emulator or a connected device required).

The app shows a setup message rather than fabricated data when Supabase isn't configured.

## Supabase setup

1. Create a Supabase project. In **SQL Editor**, run `supabase/migrations/202610140001_initial_schema.sql`.
2. In **Authentication → URL Configuration**, set the Site URL to your production web origin. Add redirect URLs for local web (`http://localhost:8081/auth/callback`), your Netlify origin (`https://YOUR-SITE.netlify.app/auth/callback`), and the native scheme (`getroasted://auth/callback`). Add your custom domain callback when configured.
3. In **Authentication → Providers**, enable Email and require email confirmation. Configure Google and GitHub with each provider's client credentials and Supabase's displayed callback URL. Enable Apple as well when you have an Apple Developer account; Apple credentials are required by Apple. Add the provider's callback URL to each provider's console. Email/password sign-up and sign-in are built in.
4. Install the Supabase CLI ([official guide](https://supabase.com/docs/guides/local-development/cli/getting-started); on Windows with Scoop, run `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`). Link the project and deploy the Edge Function from the repository root:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set RATE_LIMIT_SECRET="$(openssl rand -hex 32)"
   supabase functions deploy community-action --no-verify-jwt
   ```

   For PowerShell, generate the same secret without OpenSSL:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   $secret = [Convert]::ToBase64String($bytes)
   $rng.Dispose()
   supabase secrets set "RATE_LIMIT_SECRET=$secret"
   Remove-Variable bytes, rng, secret
   ```

   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime. `RATE_LIMIT_SECRET` is also server-only; never put it or the service role key in an `EXPO_PUBLIC_*` variable or commit them. `--no-verify-jwt` lets visitors roast without accounts; the function validates and rate-limits the request itself. The project URL and anon key in the client are public by design and protected by RLS.
5. In **Storage**, verify the migration created the public `getroasted-images` bucket with an 8 MB file-size limit. Post images are public content; don't upload private images.

The migration limits anonymous submissions by a keyed hash of the request IP (8 public actions per 10 minutes, plus a per-target cooldown). As with any IP-based limit, proxies and shared networks can affect it; it is an abuse speed bump, not identity verification. Reports are private. Three reports hide a post or roast automatically; review reports and restore/remove content in the Supabase dashboard. Anonymous roast authors are stored as `NULL`; the public roast view does not include the author column.

To triage, inspect `public.reports` in the Supabase Table Editor. In SQL Editor, restore an item by setting its status to `active` (posts) or `visible` (roasts); set it to `removed` to keep it hidden. Do not grant public API access to `reports` or `public_action_events`.

## Web deployment (Netlify)

1. Push this repository to GitHub and create a Netlify site from it.
2. Set the build command to `npm run build:web` and publish directory to `dist` (also specified in `netlify.toml`).
3. Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_SITE_URL` (the site's final HTTPS origin) in **Site configuration → Environment variables**, then deploy.
4. Add the final production callback URL (`https://YOUR-DOMAIN/auth/callback`) to Supabase Auth redirect URLs and update the Supabase Site URL.
5. For a custom domain, add it in **Netlify → Domain management** and create the DNS records Netlify provides at your DNS host. Wait for DNS propagation, then enable Netlify's automatic HTTPS certificate. Keep the `https://` origin in Supabase and social-provider callback configuration.

The Netlify redirect rule supports direct loads of dynamic share links.

## Android build and test

- Local device/emulator: install Android Studio and its SDK, run `npx expo run:android`, and test sign-up, email confirmation, Google/GitHub OAuth deep links, text/image posting, shared links, anonymous comments, and reports.
- Cloud APK for device testing: install EAS CLI, run `eas login`, configure the EAS project when prompted by `eas build:configure`, then `eas build --platform android --profile preview`. The preview profile creates an installable APK.
- Play Store: `eas build --platform android --profile production` creates an Android App Bundle. Complete Google Play signing/store setup in EAS and Play Console before publishing.

For iOS, add the same Supabase settings to an EAS iOS build and configure the `getroasted` URL scheme and provider redirect URLs. Apple OAuth needs Apple Developer credentials.

## Safety and privacy

- Account owners must have a confirmed email to publish. OAuth providers must return a verified email for Supabase to mark the account confirmed.
- Roast comments are anonymous: no account is required and no author ID is written. Public post and roast reads omit ownership/reporting identity; image object paths are public because they are embedded in shared posts. The app does not promise anonymity against network observers or infrastructure logs.
- Public text is length-limited and rendered as text. Images are re-encoded as JPEG in the app to strip common metadata, resized, and limited by Storage. Reported content is hidden after three reports; review it in the private `reports` table.
- The MVP has basic rate limits and reporting, not human pre-moderation, automated image moderation, or a guarantee that all harmful content is caught. Review reports regularly and remove inappropriate content.

## Useful commands

```sh
npm run typecheck
npm run build:web
```
