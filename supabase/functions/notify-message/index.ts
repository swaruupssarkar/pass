// Sends a WhatsApp-style push for a new chat message to the recipient's devices.
// Invoked by a Database Webhook (pg_net) on INSERT into public.messages.
//
// Collapses per conversation: collapseId = thread_id, so repeated messages from the
// same person UPDATE the one notification (and a dismissed one starts fresh — native
// Android behaviour). Respects the recipient's `chat` notify toggle; never notifies
// the sender. The in-app notification row is handled separately by notify_on_message.
//
// Deploy: supabase functions deploy notify-message --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const rec = payload.record ?? payload;
    const thread_id: string | undefined = rec?.thread_id;
    const from_user: string | undefined = rec?.from_user;
    const body: string = rec?.body ?? '';
    const image: string | null = rec?.image ?? null;
    if (!thread_id || !from_user) return json({ skipped: 'bad payload' });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: th } = await supabase.from('threads').select('user_a, user_b').eq('id', thread_id).maybeSingle();
    if (!th) return json({ skipped: 'no thread' });
    const recipient = th.user_a === from_user ? th.user_b : th.user_a;
    if (!recipient) return json({ skipped: 'no recipient' });

    // respect the recipient's chat-notifications toggle
    const { data: pref } = await supabase.from('notify_prefs').select('chat').eq('user_id', recipient).maybeSingle();
    if (pref && pref.chat === false) return json({ skipped: 'chat off' });

    const { data: tokenRows } = await supabase.from('push_tokens').select('token').eq('user_id', recipient);
    const tokens = [...new Set((tokenRows ?? []).map((r) => r.token).filter(Boolean))];
    if (!tokens.length) return json({ skipped: 'no tokens' });

    const { data: prof } = await supabase.from('profiles').select('name').eq('id', from_user).maybeSingle();
    const sender = (prof?.name || 'New message').trim();
    const text = body.trim() || (image ? 'Sent a photo' : 'New message');

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: sender,
      body: text,
      data: { threadId: thread_id, route: '/thread' },
      collapseId: thread_id, // one notification per conversation; new messages replace it
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
    return json({ sent: messages.length });
  } catch (e) {
    return new Response('error: ' + (e instanceof Error ? e.message : String(e)), { status: 500 });
  }
});

function json(b: unknown): Response {
  return new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
}
