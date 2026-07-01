// Offline write queue. Every Supabase write goes through push(): it tries the
// write immediately, and if it fails (offline / transient) the op is persisted
// to AsyncStorage and replayed on reconnect (app foreground) or next launch.
// Ops are generic table operations; client-generated uuid PKs make upserts
// idempotent, so a replayed op is safe.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { supabase } from '@/pass/supabase';

export type Op =
  | { kind: 'upsert'; table: string; row: Record<string, unknown>; onConflict?: string }
  | { kind: 'update'; table: string; values: Record<string, unknown>; match: Record<string, unknown>; matchIn?: Record<string, unknown[]> }
  | { kind: 'delete'; table: string; match: Record<string, unknown> }
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> };

// Queued ops carry the uid of the user who created them. RLS ties most writes to
// auth.uid() (e.g. listings.owner_id = auth.uid()), so a write queued by user A
// must NEVER be replayed under user B's session — it would be denied forever and,
// worse, could corrupt another account's data. We replay an op only when its uid
// matches the current session (or is unknown), and keep foreign-user ops for when
// that user signs back in on this device.
type Queued = Op & { uid?: string; tries?: number };

const KEY = 'pass.outbox.v1';
const MAX_TRIES = 25; // drop a permanently-failing ("poison") op after this many flushes
let queue: Queued[] = [];

async function currentUid(): Promise<string | undefined> {
  try {
    return (await supabase.auth.getSession()).data.session?.user.id;
  } catch {
    return undefined;
  }
}
let loaded = false;
let flushing = false;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}
async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) queue = JSON.parse(raw) as Queued[];
  } catch {
    /* ignore */
  }
}

/** Execute one op. `ok` = succeeded. `rejected` = the server returned an error
 *  (4xx/RLS/constraint — a permanent failure that counts toward poison eviction).
 *  A thrown/caught failure (offline/network) is transient: ok=false, rejected=false,
 *  so it's retried indefinitely without ever being evicted. */
export async function execResult(op: Op): Promise<{ ok: boolean; rejected: boolean }> {
  try {
    let error: unknown = null;
    if (op.kind === 'upsert') {
      ({ error } = await supabase.from(op.table).upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined));
    } else if (op.kind === 'update') {
      let q = supabase.from(op.table).update(op.values);
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as never);
      if (op.matchIn) for (const [k, arr] of Object.entries(op.matchIn)) q = q.in(k, arr as never[]);
      ({ error } = await q);
    } else if (op.kind === 'delete') {
      let q = supabase.from(op.table).delete();
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as never);
      ({ error } = await q);
    } else {
      ({ error } = await supabase.rpc(op.fn, op.args));
    }
    return { ok: !error, rejected: !!error };
  } catch {
    return { ok: false, rejected: false };
  }
}

/** Convenience boolean wrapper. */
export async function exec(op: Op): Promise<boolean> {
  return (await execResult(op)).ok;
}

/** Ids of rows with a still-queued upsert for `table` (client-uuid PKs). Lets the store
 *  keep an optimistic row visible across a wholesale pull until its write actually syncs. */
export function pendingRowIds(table: string): Set<string> {
  const ids = new Set<string>();
  for (const op of queue) {
    if (op.kind === 'upsert' && op.table === table && typeof op.row.id === 'string') ids.add(op.row.id);
  }
  return ids;
}

/** Try a write now; queue it for retry if it fails. (UI already updated optimistically.) */
export async function push(op: Op): Promise<void> {
  await load();
  // capture the author BEFORE the write — so even an op queued the instant before
  // a sign-out is reliably attributed and can't later replay under another account
  const uid = await currentUid();
  const ok = await exec(op);
  if (!ok) {
    queue.push({ ...op, uid });
    await persist();
  }
}

/** Replay queued writes in order; keep any that still fail or belong to another user. */
export async function flushOutbox(): Promise<void> {
  await load();
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const uid = await currentUid();
    const pending = [...queue];
    const keep: Queued[] = [];
    for (const op of pending) {
      // skip (but keep) ops authored by a different signed-in user — RLS would
      // deny them under this session; they replay when that user returns
      if (op.uid && uid && op.uid !== uid) {
        keep.push(op);
        continue;
      }
      const { ok, rejected } = await execResult(op);
      if (!ok) {
        // self-heal: drop a "poison" op (server keeps REJECTING it — RLS/constraint/
        // malformed) after many attempts so it can't jam the queue forever. A
        // transient/offline failure does NOT count, so a valid op is never dropped
        // during a long offline stretch — it's retried until it lands.
        const tries = (op.tries ?? 0) + (rejected ? 1 : 0);
        if (tries < MAX_TRIES) keep.push({ ...op, tries });
      }
    }
    queue = keep;
    await persist();
  } finally {
    flushing = false;
  }
}

// ---- in-flight write tracking ----
// Optimistic fire-and-forget writes (e.g. upload a photo, THEN upsert the row) do
// async work that hasn't reached the queue yet. track() registers those promises so
// drainOutbox() (called at logout) can await them before sign-out — otherwise a
// half-finished write would be lost when the next account signs in.
const inflight = new Set<Promise<unknown>>();

/** Register a fire-and-forget write so logout can wait for it. Never rejects. */
export function track<T>(p: Promise<T>): Promise<T> {
  inflight.add(p);
  void p.then(
    () => inflight.delete(p),
    () => inflight.delete(p),
  );
  return p;
}

/** Writes not yet confirmed in the database — queued (failed/offline) + in-flight. */
export function pendingCount(): number {
  return queue.length + inflight.size;
}

/** Await all in-flight writers, then replay the queue. Returns true only when
 *  EVERYTHING reached the database (nothing queued or in-flight remains). No
 *  timeout — logout blocks on this until fully synced, and refuses if offline
 *  (a queued/in-flight op means a write couldn't be confirmed). */
export async function drainOutbox(): Promise<boolean> {
  // a writer can enqueue more work as it settles (upload → upsert → queue), so
  // loop until no writers remain (bounded to avoid a runaway loop).
  for (let i = 0; inflight.size && i < 20; i++) {
    await Promise.allSettled([...inflight]);
  }
  await flushOutbox();
  return pendingCount() === 0;
}

let inited = false;
/** Flush the outbox whenever the app comes to the foreground (reconnect proxy). */
export function initOutbox(): void {
  if (inited) return;
  inited = true;
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void flushOutbox();
  });
}
