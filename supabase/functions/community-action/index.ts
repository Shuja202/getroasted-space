import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hashIp(ip: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16 * 1024) return json({ error: "Request is too large." }, 413);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSecret = Deno.env.get("RATE_LIMIT_SECRET");
  if (!supabaseUrl || !serviceKey || !rateLimitSecret) {
    console.error("Missing server configuration for community-action.");
    return json({ error: "Community submissions are temporarily unavailable." }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return json({ error: "Invalid request body." }, 400);
    }
    payload = input as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = payload.action;
  const targetId = typeof payload.targetId === "string" ? payload.targetId : "";
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "roast") {
    const postId = typeof payload.postId === "string" ? payload.postId : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
      return json({ error: "That post link is invalid." }, 400);
    }
    if (Array.from(body).length < 1 || Array.from(body).length > 500) {
      return json({ error: "A roast must be between 1 and 500 characters." }, 400);
    }
    const { data: post, error: postError } = await client
      .from("posts")
      .select("id")
      .eq("id", postId)
      .eq("status", "active")
      .maybeSingle();
    if (postError) {
      console.error("Failed to validate roast target:", postError.message);
      return json({ error: "Could not load that post right now." }, 500);
    }
    if (!post) return json({ error: "That post is unavailable." }, 404);
    const ip = request.headers.get("cf-connecting-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    if (ip === "unknown") return json({ error: "Could not verify this request. Try again later." }, 503);
    const { data: allowed, error: limitError } = await client.rpc("consume_public_action", {
      p_ip_hash: await hashIp(ip, rateLimitSecret),
      p_action: "roast",
      p_target_id: postId,
    });
    if (limitError) {
      console.error("Roast rate limit failed:", limitError.message);
      return json({ error: "Could not submit that roast right now." }, 500);
    }
    if (!allowed) return json({ error: "Too many submissions. Please wait before trying again." }, 429);
    const { error } = await client.from("roasts").insert({ post_id: postId, body });
    if (error) {
      console.error("Roast insert failed:", error.message);
      return json({ error: "Could not submit that roast right now." }, 500);
    }
    return json({ ok: true });
  }

  if (action === "report") {
    const targetType = payload.targetType;
    const reason = payload.reason;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)
      || (targetType !== "post" && targetType !== "roast")
      || !["harassment", "hate", "explicit", "spam", "other"].includes(String(reason))) {
      return json({ error: "Choose a valid report reason." }, 400);
    }
    const table = targetType === "post" ? "posts" : "roasts";
    const { data: target, error: targetError } = await client
      .from(table)
      .select("id")
      .eq("id", targetId)
      .eq("status", targetType === "post" ? "active" : "visible")
      .maybeSingle();
    if (targetError) {
      console.error("Failed to validate report target:", targetError.message);
      return json({ error: "Could not load that item right now." }, 500);
    }
    if (!target) return json({ error: "That item is unavailable." }, 404);
    const ip = request.headers.get("cf-connecting-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    if (ip === "unknown") return json({ error: "Could not verify this request. Try again later." }, 503);
    const { data: allowed, error: limitError } = await client.rpc("consume_public_action", {
      p_ip_hash: await hashIp(ip, rateLimitSecret),
      p_action: "report",
      p_target_id: targetId,
    });
    if (limitError) {
      console.error("Report rate limit failed:", limitError.message);
      return json({ error: "Could not submit that report right now." }, 500);
    }
    if (!allowed) return json({ error: "Too many submissions. Please wait before trying again." }, 429);
    const { error } = await client.rpc("record_report", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
    });
    if (error) {
      console.error("Report insert failed:", error.message);
      return json({ error: "Could not submit that report right now." }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "Choose a valid community action." }, 400);
});
