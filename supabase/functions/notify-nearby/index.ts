// Sends an Expo push to everyone with "new items near me" enabled whose notify
// address is within 100 km of a newly-posted listing. Invoked by a Database
// Webhook on INSERT into public.listings.
//
// The in-app notification row is created by the on_listing_created DB trigger —
// this function ONLY sends the mobile push, so the two are independent (in-app
// works without any of the push/Firebase setup).
//
// Deploy:  supabase functions deploy notify-nearby --no-verify-jwt
// Secret (optional):  supabase secrets set NOTIFY_HOOK_SECRET=...   then send it
//   from the webhook as the `x-hook-secret` header.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HOOK_SECRET = Deno.env.get('NOTIFY_HOOK_SECRET'); // optional shared secret
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type Target = { user_id: string; distance_km: number; tokens: string[] | null };

Deno.serve(async (req) => {
  try {
    if (HOOK_SECRET && req.headers.get('x-hook-secret') !== HOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    const payload = await req.json();
    // Supabase webhook shape: { type, table, record, old_record, ... }
    const rec = payload.record ?? payload;
    const { id, owner_id, title, lat, lng } = rec ?? {};
    if (lat == null || lng == null) return json({ skipped: 'no coords' });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data, error } = await supabase.rpc('nearby_push_targets', {
      p_lat: lat,
      p_lng: lng,
      p_owner: owner_id,
    });
    if (error) return new Response('rpc error: ' + error.message, { status: 500 });

    const messages: Record<string, unknown>[] = [];
    for (const row of (data ?? []) as Target[]) {
      const km = row.distance_km < 1 ? 'less than 1 km' : `${Math.round(row.distance_km)} km`;
      for (const token of row.tokens ?? []) {
        if (!token) continue;
        messages.push({
          to: token,
          sound: 'default',
          title: 'New item near you 🎁',
          body: `${title ?? 'A free item'} · ${km} away — be the first to claim it!`,
          data: { listingId: id, route: '/detail' },
          channelId: 'default',
          priority: 'high',
        });
      }
    }

    // Expo accepts up to 100 messages per request.
    for (let i = 0; i < messages.length; i += 100) {
      await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }

    return json({ recipients: (data ?? []).length, pushes: messages.length });
  } catch (e) {
    return new Response('error: ' + (e instanceof Error ? e.message : String(e)), { status: 500 });
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
