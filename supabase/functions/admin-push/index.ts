// Admin push broadcast. Sends an Expo push to ALL users or a list of specific
// users (by email). Called from the static admin page (daata.in/admin/push.html).
//
// Security:
//  - ADMIN_PUSH_TOKEN  : shared secret the admin types into the page (never stored).
//                        Every request must carry it; without it → 401.
//  - ADMIN_ALLOWED_ORIGINS : comma-separated web origins allowed to call from a
//                        browser (CORS). e.g. https://daata.in,https://www.daata.in
//
// Deploy:  supabase functions deploy admin-push --no-verify-jwt
// Secrets: supabase secrets set ADMIN_PUSH_TOKEN=...  ADMIN_ALLOWED_ORIGINS=...
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_TOKEN = Deno.env.get('ADMIN_PUSH_TOKEN') ?? '';
const ALLOWED = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });

  // browser origin allowlist (non-browser callers have no Origin; the token still gates them)
  if (ALLOWED.length && origin && !ALLOWED.includes(origin)) {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body.token ?? req.headers.get('x-admin-token');
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
    }

    const mode: string = body.mode ?? 'send';
    const target: string = body.target ?? 'all';
    const emails: string[] = Array.isArray(body.emails) ? body.emails : [];
    const title: string = (body.title ?? '').trim();
    const message: string = (body.message ?? '').trim();
    const image: string = (body.image ?? '').trim();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // resolve target user ids when sending to specific people (by email)
    let userIds: string[] | null = null;
    if (target === 'specific') {
      const wanted = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      if (!wanted.length) return new Response(JSON.stringify({ error: 'no emails provided' }), { status: 400, headers });
      const ids: string[] = [];
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) break;
        for (const u of data.users) {
          if (u.email && wanted.includes(u.email.toLowerCase())) ids.push(u.id);
        }
        if (data.users.length < 1000) break;
      }
      userIds = ids;
    }

    // collect device tokens
    let query = supabase.from('push_tokens').select('token, user_id');
    if (userIds) {
      query = query.in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    }
    const { data: rows, error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    const tokens = [...new Set((rows ?? []).map((r) => r.token).filter(Boolean))];

    if (mode === 'preview') {
      return new Response(JSON.stringify({ count: tokens.length }), { headers });
    }
    if (!title && !message) {
      return new Response(JSON.stringify({ error: 'title or message required' }), { status: 400, headers });
    }

    const base: Record<string, unknown> = {
      sound: 'default',
      title: title || 'Daata',
      body: message,
      channelId: 'default',
      priority: 'high',
    };
    if (image) {
      base.richContent = { image }; // big-picture on Android
      base.data = { image };
    }

    const messages = tokens.map((t) => ({ to: t, ...base }));
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    }

    return new Response(JSON.stringify({ sent, devices: tokens.length }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
  }
});
