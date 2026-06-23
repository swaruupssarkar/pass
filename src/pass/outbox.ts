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
  | { kind: 'update'; table: string; values: Record<string, unknown>; match: Record<string, unknown> }
  | { kind: 'delete'; table: string; match: Record<string, unknown> }
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> };

const KEY = 'pass.outbox.v1';
let queue: Op[] = [];
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
    if (raw) queue = JSON.parse(raw) as Op[];
  } catch {
    /* ignore */
  }
}

/** Execute one op against Supabase. Returns true on success. */
export async function exec(op: Op): Promise<boolean> {
  try {
    if (op.kind === 'upsert') {
      const { error } = await supabase.from(op.table).upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined);
      return !error;
    }
    if (op.kind === 'update') {
      let q = supabase.from(op.table).update(op.values);
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as never);
      const { error } = await q;
      return !error;
    }
    if (op.kind === 'delete') {
      let q = supabase.from(op.table).delete();
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as never);
      const { error } = await q;
      return !error;
    }
    const { error } = await supabase.rpc(op.fn, op.args);
    return !error;
  } catch {
    return false;
  }
}

/** Try a write now; queue it for retry if it fails. (UI already updated optimistically.) */
export async function push(op: Op): Promise<void> {
  await load();
  const ok = await exec(op);
  if (!ok) {
    queue.push(op);
    await persist();
  }
}

/** Replay queued writes in order; keep any that still fail. */
export async function flushOutbox(): Promise<void> {
  await load();
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const pending = [...queue];
    const keep: Op[] = [];
    for (const op of pending) {
      const ok = await exec(op);
      if (!ok) keep.push(op);
    }
    queue = keep;
    await persist();
  } finally {
    flushing = false;
  }
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
