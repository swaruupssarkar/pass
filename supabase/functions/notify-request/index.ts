// Sends a push for item requests to the right person's devices.
//   • New request (INSERT)        → notify the item OWNER  ("X wants your <item>")
//   • Request accepted (UPDATE)   → notify the REQUESTER   ("X accepted your request")
// Invoked by a Database Webhook (pg_net) on INSERT/UPDATE of public.requests.
// Respects the recipient's `chat` notify toggle (the same toggle covers chats +
// requests). The in-app notification row is handled separately by notify_on_request.
//
// Deploy: supabase functions deploy notify-request --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

// thread id mirrors the app: `p:<uuidA>-<uuidB>` with the two ids sorted
const threadIdOf = (a: string, b: string) => `p:${[a, b].sort().join('-')}`;

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const op: string = payload.type ?? '';
    const rec = payload.record ?? payload;
    const old = payload.old_record ?? null;
    const fromUser: string | undefined = rec?.from_user;
    const toUser: string | undefined = rec?.to_user;
    const listingId: string | undefined = rec?.listing_id;
    if (!fromUser || !toUser) return json({ skipped: 'bad payload' });

    // decide who to notify and with what
    let recipient: string;
    let actor: string;
    let title: string;
    let body: string;
    let data: Record<string, unknown>;
    let collapseId: string;

    if (op === 'INSERT') {
      recipient = toUser; // the owner
      actor = fromUser;
      data = { route: '/manage', listingId };
      collapseId = `req-${rec?.id}`;
      title = ''; // filled in after we resolve names below
      body = (rec?.note ?? '').trim();
    } else if (op === 'UPDATE' && rec?.status === 'accepted' && old?.status !== 'accepted') {
      recipient = fromUser; // the requester
      actor = toUser;
      data = { route: '/thread', threadId: threadIdOf(fromUser, toUser), listingId };
      collapseId = `reqacc-${rec?.id}`;
      title = '';
      body = '';
    } else {
      return json({ skipped: 'no-op' });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // respect the recipient's chat/requests toggle
    const { data: pref } = await supabase.from('notify_prefs').select('chat').eq('user_id', recipient).maybeSingle();
    if (pref && pref.chat === false) return json({ skipped: 'chat off' });

    const { data: tokenRows } = await supabase.from('push_tokens').select('token').eq('user_id', recipient);
    const tokens = [...new Set((tokenRows ?? []).map((r: { token: string }) => r.token).filter(Boolean))];
    if (!tokens.length) return json({ skipped: 'no tokens' });

    const { data: prof } = await supabase.from('profiles').select('name').eq('id', actor).maybeSingle();
    const who = (prof?.name || 'Someone').trim();
    const { data: lst } = listingId ? await supabase.from('listings').select('title').eq('id', listingId).maybeSingle() : { data: null };
    const item = (lst?.title || 'your item').trim();

    if (op === 'INSERT') {
      title = `${who} wants ${item}`;
      body = body || 'Tap to view the request';
    } else {
      title = `${who} accepted your request`;
      body = `You can now chat about ${item}`;
    }

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
      collapseId,
      channelId: 'default',
      priority: 'high',
    }));

    for (let i = 0; i < messages.length; i += 100) {
      await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
    return json({ sent: messages.length, op });
  } catch (e) {
    return new Response('error: ' + (e instanceof Error ? e.message : String(e)), { status: 500 });
  }
});

function json(b: unknown): Response {
  return new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
}
