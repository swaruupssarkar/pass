// Supabase data access for Daata. Optimistic local mutations live in the store;
// these functions push to / pull from Supabase. Images stream to Storage via the
// legacy FileSystem upload API (memory-safe — never materialised as base64).

import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';

import { SUPABASE_URL } from '@/pass/config';
import type { Handoff, Listing, Message, Notification, Profile, Request, Review, UserId } from '@/pass/data';
import { push } from '@/pass/outbox';
import { supabase } from '@/pass/supabase';

// client-generated v4 uuid → ids match the DB PK so retried inserts upsert cleanly
export const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const isRemoteUrl = (u: string) => /^https?:\/\//.test(u);

// ---------- profiles ----------

export async function fetchProfiles(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return [];
  const { data, error } = await supabase.from('profiles').select('id,name,city_id,dp,since').in('id', unique);
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, name: r.name || 'Someone', cityId: r.city_id, dp: r.dp, since: r.since }));
}

// ---------- listings ----------

type Row = Record<string, any>;

export function rowToListing(r: Row): Listing {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    blurb: r.blurb ?? '',
    cat: r.cat,
    cond: r.cond ?? '',
    desc: r.descr ?? '',
    cityId: r.city_id,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? '',
    area: r.area ?? '',
    tint: r.tint ?? '#E9E3DA',
    ph: r.ph ?? '',
    photos: r.photos ?? [],
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
    updatedAt: r.updated_at ? Date.parse(r.updated_at) : undefined,
    taken: !!r.taken,
    takenBy: r.taken_by ?? undefined,
    delisted: !!r.delisted,
  };
}

function listingToRow(l: Listing): Row {
  return {
    id: l.id,
    owner_id: l.ownerId,
    title: l.title,
    blurb: l.blurb,
    cat: l.cat,
    cond: l.cond,
    descr: l.desc,
    city_id: l.cityId,
    lat: l.lat,
    lng: l.lng,
    address: l.address,
    area: l.area,
    tint: l.tint,
    ph: l.ph,
    photos: l.photos ?? [],
    taken: l.taken,
    taken_by: l.takenBy ?? null,
  };
}

/** Stream a local file:// image to a Storage bucket; returns its public URL. */
export async function uploadImage(localUri: string, bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await uploadAsync(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${token}`, 'x-upsert': 'true', 'Content-Type': 'image/jpeg' },
    });
    if (res.status >= 200 && res.status < 300) {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/** Upload any local photos in the array; pass through already-remote URLs (e.g. seed). */
export async function uploadListingPhotos(ownerId: UserId, listingId: string, photos: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of photos) {
    if (isRemoteUrl(p)) {
      out.push(p);
      continue;
    }
    const url = await uploadImage(p, 'listing-photos', `${ownerId}/${listingId}/${uuid()}.jpg`);
    out.push(url ?? p);
  }
  return out;
}

/** Returns null on error (so the caller won't wipe a good local list). */
export async function fetchListings(): Promise<Listing[] | null> {
  const { data, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
  if (error) return null;
  return (data ?? []).map(rowToListing);
}

export async function upsertListing(l: Listing): Promise<void> {
  await push({ kind: 'upsert', table: 'listings', row: listingToRow(l) });
}

export async function setListingTaken(id: string, takenBy: UserId): Promise<void> {
  await push({ kind: 'update', table: 'listings', values: { taken: true, taken_by: takenBy }, match: { id } });
}

/** Delete a listing row (its child rows cascade in the DB). */
export async function deleteListingRemote(l: Listing): Promise<void> {
  await push({ kind: 'delete', table: 'listings', match: { id: l.id } });
}

/** Remove a listing's photos from Storage via the Storage API — Supabase blocks
 * direct DB deletes of storage.objects, so this can't be a DB trigger. Best-effort
 * (owner-scoped by the st_del policy); orphaned files are harmless. */
export async function deleteListingPhotos(l: Listing): Promise<void> {
  const paths = (l.photos ?? [])
    .map((u) => {
      const m = u.match(/\/listing-photos\/(.+?)(?:\?|$)/);
      return m ? decodeURIComponent(m[1]) : null;
    })
    .filter((p): p is string => !!p);
  if (!paths.length) return;
  try {
    await supabase.storage.from('listing-photos').remove(paths);
  } catch {
    /* orphaned files are harmless */
  }
}

// ---------- requests ----------

export function rowToRequest(r: Row): Request {
  return {
    id: r.id,
    listingId: r.listing_id,
    fromUserId: r.from_user,
    toUserId: r.to_user,
    note: r.note ?? '',
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
    status: r.status,
  };
}
export async function insertRequest(req: Request): Promise<void> {
  // upsert on the UNIQUE(listing_id, from_user) business key — re-requesting a listing
  // you previously cancelled/declined updates that row instead of violating the
  // constraint (which would poison the outbox forever).
  await push({ kind: 'upsert', table: 'requests', onConflict: 'listing_id,from_user', row: { id: req.id, listing_id: req.listingId, from_user: req.fromUserId, to_user: req.toUserId, note: req.note, status: req.status } });
}
export async function updateRequestStatus(id: string, status: string): Promise<void> {
  await push({ kind: 'update', table: 'requests', values: { status }, match: { id } });
}
export async function deleteRequestRemote(id: string): Promise<void> {
  await push({ kind: 'delete', table: 'requests', match: { id } });
}
async function fetchRequests(me: string): Promise<Request[]> {
  const { data, error } = await supabase.from('requests').select('*').or(`from_user.eq.${me},to_user.eq.${me}`);
  if (error) throw error; // let pullUserData treat it as a failed pull (preserve cache) rather than wiping to []
  return (data ?? []).map(rowToRequest);
}

// ---------- threads + messages ----------

// thread id = `p:<uuidA>-<uuidB>` (sorted). UUIDs are 36 chars and CONTAIN hyphens,
// so split by fixed width — NOT on '-' (which would shred the uuids into garbage and
// make every threads insert fail its uuid cast).
const threadPair = (id: string): [string, string] => {
  const s = id.replace(/^p:/, '');
  return [s.slice(0, 36), s.slice(37)];
};

export function rowToMessage(m: Row): Message {
  return {
    id: m.id,
    from: m.from_user,
    text: m.body ?? '',
    ts: m.created_at ? Date.parse(m.created_at) : Date.now(),
    image: m.image ?? undefined,
    // only a real reply: need both the id and the author (empty author → bad name lookup)
    replyTo: m.reply_to && m.reply_from ? { id: m.reply_to, text: m.reply_text ?? '', from: m.reply_from } : undefined,
  };
}
export async function upsertThread(id: string, fields: { listingId?: string | null; starter?: string; accepted?: boolean }): Promise<void> {
  const [a, b] = threadPair(id);
  const row: Record<string, unknown> = { id, user_a: a, user_b: b };
  if (fields.listingId !== undefined) row.listing_id = fields.listingId;
  if (fields.starter !== undefined) row.starter = fields.starter;
  if (fields.accepted !== undefined) row.accepted = fields.accepted;
  await push({ kind: 'upsert', table: 'threads', row });
}
export async function insertMessage(threadId: string, m: Message): Promise<void> {
  await push({
    kind: 'upsert',
    table: 'messages',
    row: {
      id: m.id, thread_id: threadId, from_user: m.from, body: m.text, image: m.image ?? null,
      reply_to: m.replyTo?.id ?? null, reply_text: m.replyTo?.text ?? null, reply_from: m.replyTo?.from ?? null,
    },
  });
}
/** Delete one message from the DB (sender-only, enforced by the m_del RLS policy).
 * Routed through the outbox so an offline delete still lands on reconnect. */
export async function deleteMessageRemote(id: string): Promise<void> {
  await push({ kind: 'delete', table: 'messages', match: { id } });
}
/** Best-effort: remove a chat image from Storage. Owner-scoped by st_del (only files
 * under my own uid folder are deletable), so it only succeeds for images I sent.
 * Orphaned files are harmless — the message row that referenced it is already gone. */
export async function deleteChatImage(url: string): Promise<void> {
  const m = url.match(/\/chat-images\/(.+?)(?:\?|$)/);
  if (!m) return;
  const path = decodeURIComponent(m[1]);
  try {
    await supabase.storage.from('chat-images').remove([path]);
  } catch {
    /* orphaned files are harmless */
  }
}
export async function updateThreadRead(id: string, me: string, ts: number): Promise<void> {
  const [a] = threadPair(id);
  const col = me === a ? 'read_a' : 'read_b';
  await push({ kind: 'update', table: 'threads', values: { [col]: new Date(ts).toISOString() }, match: { id } });
}
export async function deleteThreadRemote(id: string): Promise<void> {
  await push({ kind: 'delete', table: 'threads', match: { id } });
}
/** "Delete chat for me": stamp MY cleared_* column = now (RLS lets either participant
 * update the row). The other side's view is untouched; my next pull hides everything
 * at/before this time. Routed through the outbox (uid-tagged → replays only under me). */
export async function clearThreadForMe(id: string, me: string, ts: number): Promise<void> {
  const [a] = threadPair(id);
  const col = me === a ? 'cleared_a' : 'cleared_b';
  await push({ kind: 'update', table: 'threads', values: { [col]: new Date(ts).toISOString() }, match: { id } });
}

export type ThreadBundle = {
  threads: Record<string, Message[]>;
  threadListing: Record<string, string>;
  threadStarter: Record<string, UserId>;
  threadAccepted: Record<string, boolean>;
  threadRead: Record<string, Record<UserId, number>>;
  threadCleared: Record<string, number>; // my "delete chat for me" cutoff per thread
};
async function fetchThreadBundle(me: string): Promise<ThreadBundle> {
  const out: ThreadBundle = { threads: {}, threadListing: {}, threadStarter: {}, threadAccepted: {}, threadRead: {}, threadCleared: {} };
  const { data: ths, error } = await supabase.from('threads').select('*').or(`user_a.eq.${me},user_b.eq.${me}`);
  if (error) throw error;
  const ids = (ths ?? []).map((t: Row) => t.id);
  // my "delete chat for me" cutoff per thread — messages at/before this are hidden
  const cleared: Record<string, number> = {};
  for (const t of ths ?? []) {
    out.threads[t.id] = [];
    if (t.listing_id) out.threadListing[t.id] = t.listing_id;
    if (t.starter) out.threadStarter[t.id] = t.starter;
    out.threadAccepted[t.id] = !!t.accepted;
    const rr: Record<string, number> = {};
    if (t.read_a) rr[t.user_a] = Date.parse(t.read_a);
    if (t.read_b) rr[t.user_b] = Date.parse(t.read_b);
    out.threadRead[t.id] = rr;
    const myCleared = me === t.user_a ? t.cleared_a : t.cleared_b;
    if (myCleared) {
      cleared[t.id] = Date.parse(myCleared);
      out.threadCleared[t.id] = cleared[t.id]; // keep the cutoff so realtime can enforce it
    }
  }
  if (ids.length) {
    const { data: ms, error: mErr } = await supabase.from('messages').select('*').in('thread_id', ids).order('created_at', { ascending: true });
    if (mErr) throw mErr;
    for (const m of ms ?? []) {
      const msg = rowToMessage(m);
      if (cleared[m.thread_id] && msg.ts <= cleared[m.thread_id]) continue; // I cleared this chat past here
      (out.threads[m.thread_id] ??= []).push(msg);
    }
  }
  // a chat I cleared with nothing newer stays gone (don't resurrect its metadata)
  for (const id of Object.keys(cleared)) {
    if ((out.threads[id]?.length ?? 0) === 0) {
      delete out.threads[id];
      delete out.threadListing[id];
      delete out.threadStarter[id];
      delete out.threadAccepted[id];
      delete out.threadRead[id];
    }
  }
  return out;
}

// ---------- reviews ----------

export function rowToReview(r: Row): Review {
  return { id: r.id, from: r.from_user, to: r.to_user, listingId: r.listing_id ?? undefined, rating: r.rating, tags: r.tags ?? [], text: r.body ?? '', ts: r.created_at ? Date.parse(r.created_at) : Date.now() };
}
export async function insertReview(rev: Review): Promise<void> {
  await push({ kind: 'upsert', table: 'reviews', onConflict: 'from_user,listing_id', row: { id: rev.id, from_user: rev.from, to_user: rev.to, listing_id: rev.listingId ?? null, rating: rev.rating, tags: rev.tags, body: rev.text } });
}
/** Reviews authored by, or about, the current user. */
async function fetchReviews(me: string): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').or(`from_user.eq.${me},to_user.eq.${me}`);
  if (error) throw error;
  return (data ?? []).map(rowToReview);
}
/** All reviews about a given user (for their public profile). */
export async function fetchReviewsFor(userId: string): Promise<Review[]> {
  const { data } = await supabase.from('reviews').select('*').eq('to_user', userId);
  return (data ?? []).map(rowToReview);
}

// ---------- handoffs ----------

export function rowToHandoff(r: Row): Handoff {
  return { id: r.id, listingId: r.listing_id, giverId: r.giver_id, recipientId: r.recipient_id, title: r.title, photo: r.photo ?? undefined, tint: r.tint ?? '#E9E3DA', cat: r.cat ?? '', ts: r.created_at ? Date.parse(r.created_at) : Date.now() };
}
export async function insertHandoff(h: Handoff): Promise<void> {
  await push({ kind: 'upsert', table: 'handoffs', row: { id: h.id, listing_id: h.listingId, giver_id: h.giverId, recipient_id: h.recipientId, title: h.title, photo: h.photo ?? null, tint: h.tint, cat: h.cat } });
}
async function fetchHandoffs(me: string): Promise<Handoff[]> {
  const { data, error } = await supabase.from('handoffs').select('*').or(`giver_id.eq.${me},recipient_id.eq.${me}`);
  if (error) throw error;
  return (data ?? []).map(rowToHandoff);
}
/** Public given/received counts for any user (handoffs are participant-only via RLS). */
export async function fetchProfileStats(userId: string): Promise<{ given: number; received: number }> {
  const { data } = await supabase.rpc('profile_stats', { p_user: userId });
  return { given: data?.given ?? 0, received: data?.received ?? 0 };
}

// ---------- saves / blocks / notify prefs / notifications ----------

export async function addSave(me: string, listingId: string): Promise<void> {
  await push({ kind: 'upsert', table: 'saves', row: { user_id: me, listing_id: listingId } });
}
export async function removeSave(me: string, listingId: string): Promise<void> {
  await push({ kind: 'delete', table: 'saves', match: { user_id: me, listing_id: listingId } });
}
async function fetchSaves(me: string): Promise<string[]> {
  const { data, error } = await supabase.from('saves').select('listing_id').eq('user_id', me);
  if (error) throw error;
  return (data ?? []).map((r: Row) => r.listing_id);
}

export async function addBlock(me: string, blocked: string): Promise<void> {
  await push({ kind: 'upsert', table: 'blocks', row: { blocker: me, blocked } });
}
export async function removeBlock(me: string, blocked: string): Promise<void> {
  await push({ kind: 'delete', table: 'blocks', match: { blocker: me, blocked } });
}
/** Returns block keys "blocker>blocked" for rows where I block or am blocked. */
async function fetchBlocks(me: string): Promise<string[]> {
  const { data, error } = await supabase.from('blocks').select('blocker,blocked').or(`blocker.eq.${me},blocked.eq.${me}`);
  if (error) throw error;
  return (data ?? []).map((r: Row) => `${r.blocker}>${r.blocked}`);
}

export type NotifyPrefsRow = { near: boolean; chat: boolean; addr: { lat: number; lng: number; label: string } | null };
export async function upsertNotifyPrefs(me: string, p: NotifyPrefsRow): Promise<void> {
  await push({ kind: 'upsert', table: 'notify_prefs', row: { user_id: me, near: p.near, chat: p.chat, addr_lat: p.addr?.lat ?? null, addr_lng: p.addr?.lng ?? null, addr_label: p.addr?.label ?? null } });
}

/** Register this device's Expo push token so the server can notify it of nearby
 *  listings. Keyed on (user_id, token) so re-registering is idempotent. */
export async function upsertPushToken(userId: UserId, token: string, platform: string): Promise<void> {
  await push({ kind: 'upsert', table: 'push_tokens', row: { user_id: userId, token, platform } });
}
async function fetchNotifyPrefs(me: string): Promise<NotifyPrefsRow | null> {
  const { data, error } = await supabase.from('notify_prefs').select('*').eq('user_id', me).maybeSingle();
  if (error) throw error; // null here means "no prefs yet" (valid); an error must not be mistaken for that
  if (!data) return null;
  return { near: !!data.near, chat: !!data.chat, addr: data.addr_lat != null ? { lat: data.addr_lat, lng: data.addr_lng, label: data.addr_label ?? '' } : null };
}

export function rowToNotification(r: Row): Notification {
  return { id: r.id, userId: r.user_id, title: r.title ?? '', body: r.body ?? '', ts: r.created_at ? Date.parse(r.created_at) : Date.now(), read: !!r.read, kind: r.kind, threadId: r.thread_id ?? undefined, listingId: r.listing_id ?? undefined, route: r.route ?? undefined };
}
async function fetchNotifications(me: string): Promise<Notification[]> {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(rowToNotification);
}
export async function markNotificationsRead(me: string): Promise<void> {
  await push({ kind: 'update', table: 'notifications', values: { read: true }, match: { user_id: me, read: false } });
}

/** Mark a thread's coalesced message notification read in the DB so the unread dot
 *  doesn't come back after logout/re-login (local read-state alone doesn't persist). */
export async function markThreadRead(me: string, threadId: string): Promise<void> {
  await push({ kind: 'update', table: 'notifications', values: { read: true }, match: { user_id: me, thread_id: threadId, kind: 'message' } });
}
export async function deleteNotificationRemote(id: string): Promise<void> {
  await push({ kind: 'delete', table: 'notifications', match: { id } });
}
export async function clearNotificationsRemote(me: string): Promise<void> {
  await push({ kind: 'delete', table: 'notifications', match: { user_id: me } });
}

// ---------- profile ----------

export async function updateProfileRemote(me: string, fields: { name?: string; city_id?: string; dp?: string | null }): Promise<void> {
  await push({ kind: 'update', table: 'profiles', values: fields, match: { id: me } });
}
export async function reportListingRemote(listingId: string): Promise<void> {
  await push({ kind: 'rpc', fn: 'report_listing', args: { p_listing: listingId } });
}

// ---------- account deletion ----------

// Recursively collect every file path under a bucket prefix (folders have id===null).
async function listAllFiles(bucket: string, prefix: string): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data) return [];
  const files: string[] = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) files.push(...(await listAllFiles(bucket, path)));
    else files.push(path);
  }
  return files;
}
async function wipeBucket(bucket: string, uid: string): Promise<void> {
  const files = await listAllFiles(bucket, uid);
  if (files.length) {
    try {
      await supabase.storage.from(bucket).remove(files);
    } catch {
      /* best-effort */
    }
  }
}

/** Permanently delete the account: every image, every DB row, and the auth user. */
export async function deleteAccount(uid: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. wipe the user's images from all buckets (their own folders)
    await Promise.all([wipeBucket('listing-photos', uid), wipeBucket('avatars', uid), wipeBucket('chat-images', uid)]);
    // 2. delete the auth user — FK cascades remove the profile + all referencing rows
    const { error } = await supabase.rpc('delete_account');
    if (error) return { ok: false, error: error.message };
    // 3. end the session
    await supabase.auth.signOut();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}

// ---------- one-shot pull of everything the signed-in user needs ----------

export type UserData = {
  requests: Request[];
  bundle: ThreadBundle;
  reviews: Review[];
  handoffs: Handoff[];
  saves: string[];
  blocks: string[];
  notify: NotifyPrefsRow | null;
  notifications: Notification[];
};
export async function pullUserData(me: string): Promise<UserData | null> {
  try {
    const [requests, bundle, reviews, handoffs, saves, blocks, notify, notifications] = await Promise.all([
      fetchRequests(me), fetchThreadBundle(me), fetchReviews(me), fetchHandoffs(me), fetchSaves(me), fetchBlocks(me), fetchNotifyPrefs(me), fetchNotifications(me),
    ]);
    return { requests, bundle, reviews, handoffs, saves, blocks, notify, notifications };
  } catch {
    return null;
  }
}
