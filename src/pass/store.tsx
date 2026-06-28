import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ageBand,
  ageFromDob,
  CATS,
  CITIES,
  cityById,
  type Coords,
  fmtKm,
  type Gender,
  type Handoff,
  haversineKm,
  type Listing,
  type Message,
  type Notification,
  type Review,
  type Profile,
  type Request,
  REPORT_REASONS,
  type UserId,
} from '@/pass/data';
import { isExpoGo, REPORT_DELIST_THRESHOLD, REPORT_EMAIL, REPORT_ENDPOINT } from '@/pass/config';
import { supabase } from '@/pass/supabase';
import { capture, identifyUser, resetAnalytics, setPerson } from '@/pass/analytics';
import { drainOutbox, flushOutbox, initOutbox, track } from '@/pass/outbox';
import { configureForegroundNotifications, registerForPush } from '@/pass/push';

// finalize any pending auth browser session (OAuth redirect) on load
WebBrowser.maybeCompleteAuthSession();
import {
  addBlock, addSave, clearNotificationsRemote, deleteAccount as deleteAccountRemote, deleteChatImage, deleteListingPhotos, deleteListingRemote, deleteMessageRemote, deleteNotificationRemote, deleteRequestRemote,
  clearThreadForMe, fetchListings, fetchProfiles, fetchProfileStats, fetchReviewsFor, insertHandoff, insertMessage, insertRequest, insertReview,
  markNotificationsRead, markThreadRead, pullUserData, removeBlock, removeSave, reportListingRemote, rowToListing, rowToMessage,
  rowToNotification, rowToRequest, setListingTaken, updateProfileRemote, updateRequestStatus, updateThreadRead,
  uploadImage, uploadListingPhotos, upsertListing, upsertNotifyPrefs, upsertThread, uuid,
} from '@/pass/repo';
import { DEFAULT_LANG, type LangCode, translate } from '@/pass/i18n';
import { reverseGeocode } from '@/pass/places';
import { TINTS } from '@/pass/theme';

export type SortMode = 'Nearest' | 'Newest';
export type LocStatus = 'undetermined' | 'granted' | 'denied';
export type LocMode = 'city' | 'gps';

export type DialogAction = { label: string; kind?: 'primary' | 'cancel' | 'destructive'; onPress?: () => void };
export type Dialog = { title: string; message?: string; actions: DialogAction[] };

export type NotifyPrefs = { near: boolean; chat: boolean; addr: { lat: number; lng: number; label: string } | null };
const DEFAULT_NOTIFY: NotifyPrefs = { near: true, chat: true, addr: null };

/** The report payload that gets emailed (see deliverReport). Nothing is stored. */
export type ReportPayload = {
  listingId: string;
  listingTitle: string;
  reason: string;
  reportedBy: string;
  ts: number;
};

const STORAGE_KEY = 'pass.state.v5';

type State = {
  /** Supabase auth user id ('' when logged out). */
  currentUserId: UserId;
  currentUserEmail: string; // the signed-in user's email (for the Account screen)
  /** cache of user records (current user + everyone referenced), hydrated from Supabase. */
  profiles: Record<string, Profile>;
  publicStats: Record<string, { given: number; received: number }>; // cached giver hand-off counts (no 0-flash on revisit)
  /** false until the initial Supabase session check resolves (gates the splash). */
  authReady: boolean;
  lang: LangCode;
  listings: Listing[];
  requests: Request[];
  /** request ids the current user removed from their list — stay hidden even if a
   *  pull/realtime re-delivers the row (race-proof "Remove" on the Requested tab). */
  dismissedRequests: Record<string, boolean>;
  threads: Record<string, Message[]>;
  threadListing: Record<string, string>;
  /** who opened the conversation first (the other party must accept a cold DM) */
  threadStarter: Record<string, UserId>;
  /** conversations the recipient has accepted (or that came from an accepted request) */
  threadAccepted: Record<string, boolean>;
  /** last time each user viewed a thread — powers read receipts (single/double tick) */
  threadRead: Record<string, Record<UserId, number>>;
  threadCleared: Record<string, number>; // my "delete chat for me" cutoff per thread (ms)
  notifications: Notification[];
  reviews: Review[];
  /** persistent hand-off log — survives the listing being deleted */
  handoffs: Handoff[];
  // browsing location
  activeMode: LocMode;
  activeCityId: string;
  /** each user's last-chosen city, so switching accounts restores their pick */
  userCity: Record<UserId, string>;
  userLoc: Coords | null;
  userLocLabel: string | null;
  locStatus: LocStatus;
  radius: number;
  q: string;
  catFilter: string | null;
  catSel: number;
  sortMode: SortMode;
  // navigation context
  activeListingId: string | null;
  activeThreadId: string | null;
  activePersonId: UserId | null;
  // the message currently being replied to in the open thread (swipe-to-reply). Transient.
  replyDraft: { id: string; text: string; from: UserId } | null;
  galleryIdx: number;
  sheetExpanded: boolean;
  showRadius: boolean;
  safetyHidden: boolean; // chat safety banner dismissed by the user; resets on logout
  // post form
  postTitle: string;
  postCat: string;
  postCond: string;
  postAvail: string;
  postPhotos: string[];
  postAddress: string;
  postCoords: Coords | null;
  postCityId: string;
  editingId: string | null;
  // chat
  draft: string;
  // cancel-with-reason for an accepted request (role = who is cancelling)
  cancelTarget: { requestId: string; role: 'owner' | 'client' } | null;
  // mark-taken + rate
  takenPickerId: string | null;
  rateListingId: string | null;
  rateGiverId: UserId | null;
  rating: number;
  rateTags: string[];
  reviewDraft: string;
  // report
  reportReason: number | null;
  reportDone: boolean;
  /** Per-listing report tally (count only, no log) — drives the auto-delist. */
  reportCounts: Record<string, number>;
  // misc
  saved: Record<string, boolean>;
  blocked: Record<string, boolean>;
  notify: Record<UserId, NotifyPrefs>;
  dp: Record<UserId, string | null>;
  /** Per-user display-name overrides (the user can rename their own profile). */
  names: Record<string, string>;
  onboarded: boolean;
  hydrated: boolean;
  syncing: boolean; // logout is blocking the UI while it drains pending writes
  notifyNudgeDate: string; // YYYY-MM-DD the "enable notifications" nudge last showed (once/day)
  dialog: Dialog | null;
};

const INITIAL: State = {
  currentUserId: '',
  currentUserEmail: '',
  profiles: {},
  publicStats: {},
  authReady: false,
  lang: DEFAULT_LANG,
  listings: [],
  requests: [],
  dismissedRequests: {},
  threads: {},
  threadListing: {},
  threadStarter: {},
  threadAccepted: {},
  threadRead: {},
  threadCleared: {},
  notifications: [],
  reviews: [],
  handoffs: [],
  activeMode: 'city',
  activeCityId: CITIES[0].id,
  userCity: {},
  userLoc: null,
  userLocLabel: null,
  locStatus: 'undetermined',
  radius: 10,
  q: '',
  catFilter: null,
  catSel: 0,
  sortMode: 'Nearest',
  activeListingId: null,
  activeThreadId: null,
  activePersonId: null,
  replyDraft: null,
  galleryIdx: 0,
  sheetExpanded: false,
  showRadius: false,
  safetyHidden: false,
  postTitle: '',
  postCat: 'Furniture',
  postCond: 'Good',
  postAvail: 'Evenings after 6pm, this week',
  postPhotos: [],
  postAddress: '',
  postCoords: null,
  postCityId: CITIES[0].id,
  editingId: null,
  draft: '',
  cancelTarget: null,
  takenPickerId: null,
  rateListingId: null,
  rateGiverId: null,
  rating: 0,
  rateTags: [],
  reviewDraft: '',
  reportReason: null,
  reportDone: false,
  reportCounts: {},
  saved: {},
  blocked: {},
  notify: {},
  dp: {},
  names: {},
  onboarded: false,
  hydrated: false,
  syncing: false,
  notifyNudgeDate: '',
  dialog: null,
};

// ---- pure helpers ----

// current user's profile, with a safe fallback so call sites never crash pre-load
export const me = (s: State): Profile =>
  s.profiles[s.currentUserId] ?? { id: s.currentUserId, name: 'You', dp: null };
// seed-only helper (two demo users); real auth has no fixed "other" user
// resolve any user id to a Profile (cache → safe fallback)
export const profileOf = (s: State, id: UserId): Profile =>
  s.profiles[id] ?? { id, name: 'Someone', dp: null };
// avatar URL for any user: current-user optimistic override → cached profile dp
export const userDp = (s: State, id: UserId): string | null => s.dp[id] ?? profileOf(s, id).dp ?? null;

export function nearestCity(c: Coords) {
  return CITIES.reduce((best, city) =>
    haversineKm(c, city) < haversineKm(c, best) ? city : best
  );
}

/** Origin the radius is measured from: GPS when in current-location mode, else the chosen city. */
export function activeOrigin(s: State): Coords {
  if (s.activeMode === 'gps' && s.userLoc) return s.userLoc;
  const c = cityById(s.activeCityId);
  return { lat: c.lat, lng: c.lng };
}

export function activeLocationLabel(s: State): string {
  if (s.activeMode === 'gps') return s.userLocLabel ?? 'Current location';
  return cityById(s.activeCityId).name;
}

/**
 * A real, precise origin for the current user: live GPS when browsing by current
 * location, otherwise their saved notify address. null = only a city is selected,
 * so distance to a listing is unknowable and must not be shown.
 */
export function userPoint(s: State): Coords | null {
  if (s.activeMode === 'gps' && s.userLoc) return s.userLoc;
  const addr = s.notify?.[s.currentUserId]?.addr;
  return addr ? { lat: addr.lat, lng: addr.lng } : null;
}

/** Distance label from the user's real point, or null when only a city is set. */
export const distLabel = (s: State, l: Listing): string | null => {
  const p = userPoint(s);
  return p ? fmtKm(haversineKm(p, { lat: l.lat, lng: l.lng })) : null;
};

/** A listing is reserved once its owner has accepted someone's request. */
export const isReserved = (s: State, listingId: string): boolean =>
  s.requests.some((r) => r.listingId === listingId && r.status === 'accepted');

/** Listings other users have posted, in the active location + radius, not taken or reserved. */
export function browseListings(s: State): Listing[] {
  let list = s.listings.filter(
    (l) => !l.taken && !isReserved(s, l.id) && !isDelisted(s, l.id) && l.ownerId !== s.currentUserId && !isBlocked(s, l.ownerId)
  );
  // city mode (or GPS mode that never got a fix) scopes to the active city —
  // never fall through to showing every listing worldwide
  if (s.activeMode === 'city' || (s.activeMode === 'gps' && !s.userLoc)) list = list.filter((l) => l.cityId === s.activeCityId);
  // radius only makes sense from a live GPS location; a city alone has no precise origin
  const gps = s.activeMode === 'gps' && s.userLoc ? s.userLoc : null;
  if (gps) list = list.filter((l) => haversineKm(gps, { lat: l.lat, lng: l.lng }) <= s.radius);
  if (s.catFilter) list = list.filter((l) => l.cat === s.catFilter);
  const q = s.q.trim().toLowerCase();
  if (q) list = list.filter((l) => `${l.title} ${l.blurb} ${l.cat}`.toLowerCase().includes(q));
  list = list.slice();
  const sortPoint = userPoint(s);
  if (sortPoint && s.sortMode === 'Nearest') {
    list.sort((a, b) => haversineKm(sortPoint, { lat: a.lat, lng: a.lng }) - haversineKm(sortPoint, { lat: b.lat, lng: b.lng }));
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
}

export const myListings = (s: State): Listing[] =>
  s.listings.filter((l) => l.ownerId === s.currentUserId).sort((a, b) => b.createdAt - a.createdAt);

export const savedListings = (s: State): Listing[] => s.listings.filter((l) => s.saved[l.id]);

const blockKey = (blocker: UserId, blocked: UserId) => `${blocker}>${blocked}`;
/** The current user has blocked `otherId` (only the blocker can unblock). */
export const iBlocked = (s: State, otherId: UserId): boolean => !!s.blocked[blockKey(s.currentUserId, otherId)];
/** A block exists in EITHER direction — hides content and gates messaging both ways (WhatsApp-style). */
export const isBlocked = (s: State, otherId: UserId): boolean =>
  !!s.blocked[blockKey(s.currentUserId, otherId)] || !!s.blocked[blockKey(otherId, s.currentUserId)];
/** Everyone the current user has blocked (derived from the block map keys). */
export const blockedUserIds = (s: State): UserId[] =>
  Object.entries(s.blocked)
    .filter(([k, v]) => v && k.startsWith(`${s.currentUserId}>`))
    .map(([k]) => k.split('>')[1]);

export const listingById = (s: State, id: string | null): Listing | null =>
  s.listings.find((l) => l.id === id) ?? null;

export const activeListing = (s: State): Listing | null => listingById(s, s.activeListingId);

export function ownerOf(s: State, l: Listing): Profile {
  return profileOf(s, l.ownerId);
}

// ---- requests ----

export function requestsFor(s: State, listingId: string): { request: Request; user: Profile }[] {
  return s.requests
    .filter((r) => r.listingId === listingId)
    .map((r) => ({ request: r, user: profileOf(s, r.fromUserId) }));
}

export const myRequests = (s: State): { request: Request; listing: Listing | null }[] =>
  s.requests
    .filter((r) => r.fromUserId === s.currentUserId && !s.dismissedRequests?.[r.id])
    .sort((a, b) => b.createdAt - a.createdAt) // stable newest-first (matches incomingRequests)
    .map((r) => ({ request: r, listing: listingById(s, r.listingId) }));

/** Requests other people made for the current user's listings. */
export const incomingRequests = (
  s: State
): { request: Request; user: Profile; listing: Listing | null }[] =>
  s.requests
    .filter((r) => r.toUserId === s.currentUserId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({ request: r, user: profileOf(s, r.fromUserId), listing: listingById(s, r.listingId) }));

/** A pending request from `otherId` to the current user (shown inside their chat thread). */
export const pendingIncomingFrom = (s: State, otherId: UserId): Request | null =>
  s.requests.find((r) => r.toUserId === s.currentUserId && r.fromUserId === otherId && r.status === 'pending') ?? null;

/** The current user's request on a listing (to gate the detail CTA). */
export const myRequestFor = (s: State, listingId: string): Request | null =>
  s.requests.find((r) => r.listingId === listingId && r.fromUserId === s.currentUserId) ?? null;

// ---- threads ----
// ONE conversation per pair of users, regardless of which listing it started from.
// threadId = `p:<userA>-<userB>` (sorted). threadListing[id] remembers the latest listing context.

export const threadId = (a: UserId, b: UserId): string => `p:${[a, b].sort().join('-')}`;
// id = `p:<uuidA>-<uuidB>`; uuids are 36 chars and contain hyphens, so slice by
// fixed width rather than splitting on '-'.
export const threadUsers = (id: string): UserId[] => {
  const s = id.replace(/^p:/, '');
  return [s.slice(0, 36), s.slice(37)] as UserId[];
};

export function otherInThread(s: State, id: string): UserId {
  const [a, b] = threadUsers(id);
  return s.currentUserId === a ? b : a;
}

/**
 * True when the other person started this conversation (a cold DM) and the
 * current user has not accepted it yet. The recipient sees accept / delete /
 * block instead of a reply box until they accept.
 */
// A chat needs the accept/delete/block gate ONLY when it's from a stranger: the
// other person started it, I haven't accepted, AND we have no REAL relationship.
// A real relationship = we actually chatted (the thread was accepted, or I replied)
// OR a product changed hands / a request was ACCEPTED. A bare request that got no
// reply and no acceptance does NOT count — that's still a stranger, so a later
// message from them stays gated.
export const threadPendingForMe = (s: State, id: string): boolean => {
  const me = s.currentUserId;
  const starter = s.threadStarter?.[id];
  if (!starter || starter === me || s.threadAccepted?.[id]) return false;
  const [a, b] = threadUsers(id);
  const other = a === me ? b : a;
  const handed = s.handoffs.some((h) => (h.giverId === me && h.recipientId === other) || (h.giverId === other && h.recipientId === me));
  const acceptedReq = s.requests.some((r) => r.status === 'accepted' && ((r.fromUserId === me && r.toUserId === other) || (r.fromUserId === other && r.toUserId === me)));
  const iReplied = (s.threads[id] ?? []).some((m) => m.from === me);
  return !handed && !acceptedReq && !iReplied;
};

export type ThreadMeta = {
  id: string;
  listingId: string | null;
  otherId: UserId;
  otherName: string;
  item: string;
  tint: string;
  area: string;
};

export function threadMeta(s: State, id: string): ThreadMeta {
  const otherId = otherInThread(s, id);
  const listingId = s.threadListing[id] ?? null;
  const l = listingId ? listingById(s, listingId) : null;
  return {
    id,
    listingId,
    otherId,
    otherName: userName(s, otherId),
    item: l?.title ?? 'Chat',
    tint: l?.tint ?? TINTS[0],
    area: l?.area ?? '',
  };
}

export const threadMessages = (s: State, id: string | null): Message[] => (id ? s.threads[id] ?? [] : []);
export const activeThreadMessages = (s: State): Message[] => threadMessages(s, s.activeThreadId);

export type InboxRow = ThreadMeta & { last: string; time: string; unread: boolean; ts: number };

export function inboxRows(s: State): InboxRow[] {
  const ids = Object.keys(s.threads).filter((id) => {
    const [a, b] = threadUsers(id);
    return id.startsWith('p:') && a !== b && (a === s.currentUserId || b === s.currentUserId) && (s.threads[id]?.length ?? 0) > 0;
  });
  const unreadThreads = new Set(
    s.notifications.filter((n) => n.userId === s.currentUserId && !n.read && n.kind === 'message' && n.threadId).map((n) => n.threadId)
  );
  const rows: InboxRow[] = ids.map((id) => {
    const m = threadMeta(s, id);
    const msgs = s.threads[id] ?? [];
    const last = msgs[msgs.length - 1];
    return {
      ...m,
      last: last ? last.text : '',
      time: last ? fmtAgo(last.ts) : '',
      unread: unreadThreads.has(id),
      ts: last ? last.ts : 0,
    };
  });
  rows.sort((a, b) => b.ts - a.ts);
  return rows;
}

// ---- notifications ----

export const notificationsFor = (s: State): Notification[] =>
  s.notifications.filter((n) => n.userId === s.currentUserId).sort((a, b) => b.ts - a.ts);

export const unreadCount = (s: State): number =>
  s.notifications.filter((n) => n.userId === s.currentUserId && !n.read).length;

/** Any unread chat message for the current user (drives the Chats tab dot). */
export const hasUnreadChats = (s: State): boolean =>
  s.notifications.some((n) => n.userId === s.currentUserId && !n.read && n.kind === 'message');

export const reviewsFor = (s: State, userId: UserId): Review[] =>
  (s.reviews ?? []).filter((r) => r.to === userId).sort((a, b) => b.ts - a.ts);

/** Has the current user already reviewed this listing? (one review per item) */
export const hasReviewed = (s: State, listingId: string | null | undefined): boolean =>
  !!listingId && (s.reviews ?? []).some((r) => r.from === s.currentUserId && r.listingId === listingId);

/** An item `giverId` handed to the current user that still needs a review (drives the in-chat rate prompt). */
export const pendingReviewFrom = (s: State, giverId: UserId): Listing | null =>
  s.listings.find((l) => l.ownerId === giverId && l.takenBy === s.currentUserId && !hasReviewed(s, l.id)) ?? null;

/** Persistent hand-off records by a user (survive listing deletion). */
export const handoffsBy = (s: State, userId: UserId): Handoff[] =>
  (s.handoffs ?? []).filter((h) => h.giverId === userId).sort((a, b) => b.ts - a.ts);
export const myHandoffs = (s: State): Handoff[] => handoffsBy(s, s.currentUserId);
/** Hand-offs received by a user (also survive listing deletion). */
export const handoffsTo = (s: State, userId: UserId): Handoff[] =>
  (s.handoffs ?? []).filter((h) => h.recipientId === userId).sort((a, b) => b.ts - a.ts);

/** Display name for a user, honouring any self-set override. */
export const userName = (s: State, id: UserId): string =>
  s.names?.[id] ?? s.profiles[id]?.name ?? 'Someone';

/** Real average rating computed from received reviews; null when none yet. */
export function userRating(s: State, id: UserId): number | null {
  const rs = reviewsFor(s, id);
  if (rs.length === 0) return null;
  return Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10;
}

/** How many reports a listing has received (this device). */
export const reportCount = (s: State, listingId: string): number =>
  s.reportCounts?.[listingId] ?? 0;

/** Delisted when the server flag is set (cross-device) or the local tally crosses
 * the threshold (immediate feedback for the reporter before realtime lands). */
export const isDelisted = (s: State, listingId: string): boolean => {
  const l = s.listings.find((x) => x.id === listingId);
  return !!l?.delisted || reportCount(s, listingId) >= REPORT_DELIST_THRESHOLD;
};

// ---- time format ----

export function fmtAgo(ts: number, now: number = Date.now()): string {
  const d = Math.max(0, now - ts);
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
/** Full relative phrase: "now" under a minute, else the localized "{n}m ago" form.
 * Avoids the "now ago" bug from templates that hardcoded a trailing "ago". */
export function fmtRel(
  ts: number,
  tr: (key: string, params?: Record<string, string | number>) => string,
  now: number = Date.now()
): string {
  const m = Math.floor(Math.max(0, now - ts) / 60_000);
  if (m < 1) return tr('time.now');
  return tr('time.ago', { ago: fmtAgo(ts, now) });
}
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ap = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${mm} ${ap}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Absolute calendar date, e.g. "20 Jun 2026". */
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const MS_DAY = 86400000;
/** Midnight (local) of the day containing `ts` — used to group chat messages by day. */
export const dayStamp = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
/** today / yesterday / formatted date — for WhatsApp-style chat day separators. */
export function chatDay(ts: number): { today: boolean; yesterday: boolean; date: string } {
  const today = dayStamp(Date.now());
  return { today: dayStamp(ts) === today, yesterday: dayStamp(ts) === dayStamp(today - MS_DAY), date: fmtDate(ts) };
}

let SEQ = 0;
const uid = (p: string) => `${p}_${Date.now()}_${SEQ++}`;

/**
 * Emails a listing report to REPORT_EMAIL via the configured Formspree endpoint.
 * No-op (with a dev warning) until EXPO_PUBLIC_REPORT_ENDPOINT is set. Fire-and-
 * forget: failures are swallowed so the UI flow never blocks on the network.
 */
function deliverReport(payload: ReportPayload): void {
  if (!REPORT_ENDPOINT) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[report] No REPORT_ENDPOINT set — report not emailed. See src/pass/config.ts');
    }
    return;
  }
  fetch(REPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: REPORT_EMAIL,
      _subject: `pass report: ${payload.listingTitle}`,
      listing: payload.listingTitle,
      listingId: payload.listingId,
      reason: payload.reason,
      reportedBy: payload.reportedBy,
      at: new Date(payload.ts).toISOString(),
    }),
  }).catch(() => {});
}

// ---- store ----

type Store = {
  s: State;
  patch: (p: Partial<State>) => void;
  // auth
  signInWithEmail: (email: string, createUser?: boolean) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Set/replace the current (just-verified) user's password. */
  setPassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Providers linked to the signed-in user, e.g. ['email','google']. */
  hasPassword: () => Promise<boolean>;
  /** Google OAuth via an in-app browser tab; auto-links to the same-email account. `isNew` = account just created. */
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string; cancelled?: boolean; isNew?: boolean }>;
  logout: () => Promise<{ ok: boolean }>;
  dropSession: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;
  // location
  setCity: (cityId: string) => void;
  useCurrentLocation: () => Promise<'granted' | 'denied' | 'error'>;
  requestLocation: () => Promise<void>;
  requestNotifications: () => Promise<'granted' | 'denied' | 'error'>;
  // browse
  openListing: (id: string) => void;
  toggleSave: (id: string) => void;
  viewPerson: (id: UserId) => void;
  /** Fetch another user's public profile data (reviews + hand-off counts) + cache the people referenced. */
  loadPublicProfile: (userId: UserId) => Promise<{ given: number; received: number }>;
  // post
  startPost: () => void;
  startEdit: (id: string) => void;
  setPickup: (coords: Coords, address: string) => void;
  addPostPhoto: (uri: string) => void;
  removePostPhoto: (uri: string) => void;
  submitPost: () => string | null;
  deleteListing: (id: string) => void;
  // requests + chat
  requestListing: (listingId: string, note: string) => void;
  acceptRequest: (requestId: string) => void;
  declineRequest: (requestId: string) => void;
  cancelRequest: (requestId: string, reason?: string) => void;
  openCancelReason: (requestId: string, role: 'owner' | 'client') => void;
  closeCancelReason: () => void;
  removeRequest: (requestId: string) => void;
  openThreadFor: (listingId: string) => string;
  openThreadWith: (personId: UserId) => string;
  deleteThread: (id: string) => void;
  acceptThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  openThread: (id: string) => void;
  sendMsg: (text: string) => void;
  sendImage: (uri: string) => void;
  deleteMessage: (msgId: string) => void;
  setReply: (msgId: string | null) => void;
  shareLoc: () => Promise<void>;
  blockUser: (id: UserId) => void;
  unblockUser: (id: UserId) => void;
  // mark taken + rate
  openTakenPicker: (listingId: string) => void;
  confirmTaken: (listingId: string, recipientId: UserId | null) => void;
  openRate: (notif: Notification) => void;
  startRateForListing: (listingId: string, rating?: number) => void;
  submitRate: () => void;
  toggleRateTag: (t: string) => void;
  // notifications
  markNotifsRead: () => void;
  deleteNotif: (id: string) => void;
  clearNotifs: () => void;
  openNotif: (n: Notification) => string | null;
  // report / onboarding
  submitReport: () => void;
  markOnboarded: () => void;
  recordNotifyNudge: () => void;
  // profile editing
  setName: (name: string) => void;
  saveProfileInfo: (info: { name: string; gender: Gender | null; dob: string | null }) => void;
  setDp: (uri: string | null) => void;
  setNotifyNear: (on: boolean) => void;
  setNotifyChat: (on: boolean) => void;
  setNotifyAddress: (coords: Coords, label: string) => void;
  restart: () => void;
  // branded dialogs
  showAlert: (title: string, message?: string) => void;
  showConfirm: (opts: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void }) => void;
  closeDialog: () => void;
};

const PassContext = createContext<Store | null>(null);

// Listings deleted this session. A slow edit (photo upload + trailing upsert) must
// not re-create a row the user deleted mid-upload — the upsert checks this set and
// bails, so delete wins.
const deletedListings = new Set<string>();
// message ids deleted locally — stop an in-flight image upload→insert from
// resurrecting a message the user deleted before its upload finished.
const deletedMessages = new Set<string>();

export function PassProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(INITIAL);

  const store = useMemo<Store>(() => {
    const patch = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }));

    const notify = (prev: State, n: Omit<Notification, 'id' | 'ts' | 'read'>): Notification => ({
      ...n,
      id: uid('n'),
      ts: Date.now(),
      read: false,
    });

    // open/ensure the pair conversation between the current user and `otherId`,
    // remembering `listingId` as the latest context shown in the thread header.
    const ensurePairThread = (
      prev: State,
      otherId: UserId,
      listingId?: string
    ): { id: string; threads: Record<string, Message[]>; threadListing: Record<string, string> } => {
      const id = threadId(prev.currentUserId, otherId);
      const threads = prev.threads[id] ? prev.threads : { ...prev.threads, [id]: [] };
      const threadListing = listingId ? { ...prev.threadListing, [id]: listingId } : prev.threadListing;
      return { id, threads, threadListing };
    };

    return {
      s,
      patch,

      signInWithEmail: async (email, createUser = true) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: createUser },
        });
        return error ? { ok: false, error: error.message } : { ok: true };
      },

      verifyOtp: async (email, token) => {
        const e = email.trim().toLowerCase();
        const t = token.trim();
        // 'email' covers magic-link OTP (existing users); 'signup' covers the
        // confirm-signup OTP (new users). Try the generic first, then fall back.
        let res = await supabase.auth.verifyOtp({ email: e, token: t, type: 'email' });
        if (res.error) res = await supabase.auth.verifyOtp({ email: e, token: t, type: 'signup' });
        // on success the onAuthStateChange listener populates currentUserId + profile
        return res.error ? { ok: false, error: res.error.message } : { ok: true };
      },

      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        // success → onAuthStateChange populates currentUserId + profile
        return error ? { ok: false, error: error.message } : { ok: true };
      },

      // Used right after OTP verification in sign-up: the user already has a
      // session, so we just attach a password to the account.
      setPassword: async (password) => {
        // stamp has_password so future sign-ins know a password exists (Google
        // accounts that set one have no 'email' identity to detect it otherwise).
        const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
        return error ? { ok: false, error: error.message } : { ok: true };
      },

      hasPassword: async () => {
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        if (!u) return false;
        // setPassword stamps user_metadata.has_password (the reliable signal —
        // updateUser({password}) does NOT add an 'email' identity, so identities
        // alone wrongly look "passwordless" forever). Email-signup users still
        // have a real 'email' identity, so honour that too.
        return !!u.user_metadata?.has_password || (u.identities ?? []).some((i) => i.provider === 'email');
      },

      signInWithGoogle: async () => {
        try {
          // Must exactly match a Supabase "Redirect URLs" allow-list entry. In
          // Expo Go the scheme differs (exp://…) so OAuth deep-link needs the dev
          // build, where the app scheme is `daata`.
          const redirectTo = Linking.createURL('auth-callback', { scheme: 'daata' });
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error || !data?.url) return { ok: false, error: error?.message };
          // opens an in-app browser tab; returns when Google redirects back to us
          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (res.type !== 'success' || !res.url) return { ok: false, cancelled: true };
          const code = new URL(res.url).searchParams.get('code');
          if (!code) return { ok: false, error: 'No authorization code returned.' };
          const { data: sess, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) return { ok: false, error: exErr.message };
          // brand-new account if it was created on (≈) this sign-in
          const u = sess?.user;
          const isNew = !!u && !!u.created_at && Math.abs(Date.parse(u.last_sign_in_at ?? u.created_at) - Date.parse(u.created_at)) < 10000;
          // success → onAuthStateChange sets currentUserId + pulls data
          return { ok: true, isNew };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Google sign-in failed' };
        }
      },

      // Light, silent sign-out used mid-login to revoke the OTP-created session when
      // the password is wrong (so OTP alone can't grant access). No drain/overlay.
      dropSession: async () => {
        try {
          await supabase.auth.signOut();
        } catch {}
      },

      logout: async () => {
        // Try to sync everything, but NEVER trap the user: show the overlay, drain
        // for a short bounded window, then sign out regardless. Anything not synced
        // stays in the durable, uid-tagged outbox and replays on THIS user's next
        // sign-in (never under another account) — so logout is fast AND lossless.
        setS((prev) => ({ ...prev, syncing: true }));
        await Promise.race([drainOutbox(), new Promise<void>((r) => setTimeout(r, 6000))]);
        // sign out. The network revoke can fail offline; that's fine (the local
        // session still clears), so don't let it strand the overlay.
        try {
          await supabase.auth.signOut();
        } catch {}
        resetAnalytics(); // un-link analytics so the next account isn't merged in
        // module-level resurrection guards hold THIS user's deleted ids — drop them so
        // they can't carry over (data-bleed hygiene; same invariant as the slices below)
        deletedMessages.clear();
        deletedListings.clear();
        setS((prev) => ({
          ...prev,
          syncing: false,
          currentUserId: '',
          currentUserEmail: '',
          safetyHidden: false, // show the chat safety banner again for the next sign-in
          onboarded: false, // per-user; the next account re-evaluates onboarding (set from their profile on sign-in)
          activeThreadId: null,
          activeListingId: null,
          activePersonId: null,
          replyDraft: null,
          q: '',
          catFilter: null,
          draft: '',
          // clear this user's private data so the next account can't see it before
          // their own pull lands (these are all re-populated by applyUser on sign-in)
          saved: {},
          requests: [],
          threads: {},
          threadListing: {},
          threadStarter: {},
          threadAccepted: {},
          threadRead: {},
          threadCleared: {},
          notifications: [],
          handoffs: [],
          reviews: [],
          blocked: {},
        }));
        return { ok: true };
      },

      // permanently delete the account: all images + every DB row + the auth user
      deleteAccount: async () => {
        const me = s.currentUserId;
        if (!me) return { ok: false, error: 'Not signed in' };
        const res = await deleteAccountRemote(me);
        // wipe all local state/cache so nothing of theirs lingers on the device
        if (res.ok) setS({ ...INITIAL, hydrated: true, authReady: true });
        return res;
      },

      setCity: (cityId) => {
        const finishingOnboarding = !s.onboarded; // first city = last onboarding step
        setS((prev) => ({
          ...prev,
          activeMode: 'city',
          activeCityId: cityId,
          onboarded: true, // picking a city completes onboarding — don't depend on feed mount
          // Suppress the "enable notifications" nudge on the same day onboarding finishes;
          // if they didn't grant it during onboarding, the first nudge fires the NEXT day.
          notifyNudgeDate: finishingOnboarding ? new Date().toISOString().slice(0, 10) : prev.notifyNudgeDate,
          userCity: { ...prev.userCity, [prev.currentUserId]: cityId },
          profiles: prev.profiles[prev.currentUserId]
            ? { ...prev.profiles, [prev.currentUserId]: { ...prev.profiles[prev.currentUserId], cityId } }
            : prev.profiles,
        }));
        if (s.currentUserId) track(updateProfileRemote(s.currentUserId, { city_id: cityId }));
        capture('city_selected', { cityId });
        setPerson({ city: CITIES.find((c) => c.id === cityId)?.name ?? cityId }); // segment users by city
        if (finishingOnboarding) {
          capture('onboarding_completed', undefined, { set: { onboarded: true }, setOnce: { onboarded_at: new Date().toISOString() } });
        }
      },

      useCurrentLocation: async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setS((prev) => ({ ...prev, locStatus: 'denied' }));
          return 'denied';
        }
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          // GPS also sets the saved home city (nearest) so the Profile shows the right
          // city, onboarding completes, and it persists across logout/login + DB.
          const near = nearestCity(coords);
          const me2 = s.currentUserId;
          setS((prev) => ({
            ...prev,
            locStatus: 'granted',
            userLoc: coords,
            activeMode: 'gps',
            userLocLabel: 'Current location',
            activeCityId: near.id,
            onboarded: true,
            userCity: { ...prev.userCity, [prev.currentUserId]: near.id },
            profiles: prev.profiles[prev.currentUserId]
              ? { ...prev.profiles, [prev.currentUserId]: { ...prev.profiles[prev.currentUserId], cityId: near.id } }
              : prev.profiles,
          }));
          if (me2) track(updateProfileRemote(me2, { city_id: near.id }));
          setPerson({ city: near.name });
          const label = await reverseGeocode(coords.lat, coords.lng);
          setS((prev) => ({ ...prev, userLocLabel: label }));
          return 'granted';
        } catch {
          // permission granted but no fix — stay in city mode (don't switch to gps with no userLoc)
          setS((prev) => ({ ...prev, locStatus: 'granted' }));
          return 'error';
        }
      },

      requestLocation: async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setS((prev) => ({ ...prev, locStatus: 'denied' }));
          return;
        }
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setS((prev) => ({ ...prev, locStatus: 'granted', userLoc: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
        } catch {
          setS((prev) => ({ ...prev, locStatus: 'granted' }));
        }
      },

      // ask the OS for real notification permission (shows the system dialog).
      // expo-notifications is lazy-loaded so its native module is never touched
      // at app boot — in Expo Go (no notifications module) that would crash.
      requestNotifications: async () => {
        if (isExpoGo) return 'error'; // expo-notifications throws on import in Expo Go
        try {
          const Notifications = await import('expo-notifications');
          const current = await Notifications.getPermissionsAsync();
          if (current.granted || current.status === 'granted') return 'granted';
          const res = await Notifications.requestPermissionsAsync();
          return res.granted || res.status === 'granted' ? 'granted' : 'denied';
        } catch {
          return 'error';
        }
      },

      openListing: (id) => {
        capture('listing_viewed', { listingId: id });
        setS((prev) => ({ ...prev, activeListingId: id, galleryIdx: 0, sheetExpanded: false }));
      },
      toggleSave: (id) => {
        if (!s.currentUserId) return;
        const willSave = !s.saved[id];
        setS((prev) => ({ ...prev, saved: { ...prev.saved, [id]: !prev.saved[id] } }));
        if (willSave) {
          track(addSave(s.currentUserId, id));
          capture('listing_saved', { listingId: id }, { set: { has_saved: true } });
        } else {
          track(removeSave(s.currentUserId, id));
          capture('listing_unsaved', { listingId: id });
        }
      },
      viewPerson: (id) => setS((prev) => ({ ...prev, activePersonId: id })),

      loadPublicProfile: async (userId) => {
        // reviews are public-readable; hand-off counts come from a security-definer
        // RPC (handoffs themselves are participant-only under RLS)
        const [reviews, stats] = await Promise.all([fetchReviewsFor(userId), fetchProfileStats(userId)]);
        // cache reviewer profiles so names/avatars resolve in the cards
        const reviewerIds = reviews.map((r) => r.from).filter((x) => !s.profiles[x]);
        const profs = await fetchProfiles(reviewerIds);
        // merge reviews (dedupe by id) so reviewsFor/userRating work for this user
        // everywhere (giver profile + detail owner card)
        setS((prev) => {
          const revById = new Map(prev.reviews.map((r) => [r.id, r]));
          reviews.forEach((r) => revById.set(r.id, r));
          return {
            ...prev,
            reviews: [...revById.values()],
            profiles: { ...prev.profiles, ...Object.fromEntries(profs.map((p) => [p.id, p])) },
            publicStats: { ...prev.publicStats, [userId]: stats }, // cache so a revisit shows instantly
          };
        });
        return stats;
      },

      startPost: () =>
        setS((prev) => ({
          ...prev,
          editingId: null,
          postTitle: '',
          postCat: 'Furniture',
          postCond: 'Good',
          postAvail: 'Evenings after 6pm, this week',
          postPhotos: [],
          postAddress: '',
          postCoords: null,
          postCityId: prev.profiles[prev.currentUserId]?.cityId ?? prev.activeCityId,
        })),

      startEdit: (id) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === id);
          if (!l) return prev;
          const avail = l.desc.startsWith('Available: ') ? l.desc.slice('Available: '.length).replace(/\.$/, '') : '';
          return {
            ...prev,
            editingId: id,
            postTitle: l.title,
            postCat: l.cat,
            postCond: l.cond,
            postAvail: avail,
            postPhotos: l.photos ?? [],
            postAddress: l.address,
            postCoords: { lat: l.lat, lng: l.lng },
            postCityId: l.cityId,
          };
        }),

      setPickup: (coords, address) =>
        setS((prev) => ({ ...prev, postCoords: coords, postAddress: address, postCityId: nearestCity(coords).id })),

      addPostPhoto: (uri) => setS((prev) => ({ ...prev, postPhotos: [...prev.postPhotos, uri].slice(0, 4) })),
      removePostPhoto: (uri) => setS((prev) => ({ ...prev, postPhotos: prev.postPhotos.filter((u) => u !== uri) })),

      submitPost: () => {
        let outId: string | null = null;
        let toSync: Listing | null = null;
        setS((prev) => {
          const coords = prev.postCoords ?? activeOrigin(prev);
          const cityId = prev.postCoords ? nearestCity(prev.postCoords).id : prev.postCityId;
          const title = prev.postTitle.trim() || 'Untitled item';
          const area = prev.postAddress.split(',')[0]?.trim() || cityById(cityId).name;
          const desc = prev.postAvail.trim() ? `Available: ${prev.postAvail.trim()}.` : 'Free to a good home.';
          if (prev.editingId) {
            outId = prev.editingId;
            const listings = prev.listings.map((l) =>
              l.id === prev.editingId
                ? { ...l, title, cat: prev.postCat, cond: prev.postCond, blurb: `${prev.postCond} · ${prev.postCat}`, desc, address: prev.postAddress, area, lat: coords.lat, lng: coords.lng, cityId, photos: prev.postPhotos, updatedAt: Date.now() }
                : l
            );
            toSync = listings.find((l) => l.id === prev.editingId) ?? null;
            return { ...prev, listings, editingId: null };
          }
          const id = uuid();
          outId = id;
          const listing: Listing = {
            id,
            ownerId: prev.currentUserId,
            title,
            blurb: `${prev.postCond} · ${prev.postCat}`,
            cat: prev.postCat,
            cond: prev.postCond,
            desc,
            cityId,
            lat: coords.lat,
            lng: coords.lng,
            address: prev.postAddress || cityById(cityId).name,
            area,
            tint: TINTS[prev.listings.length % TINTS.length],
            ph: title.toLowerCase(),
            photos: prev.postPhotos,
            createdAt: Date.now(),
            taken: false,
          };
          toSync = listing;
          return { ...prev, listings: [listing, ...prev.listings], activeListingId: id };
        });
        // push to Supabase. Persist the ROW FIRST (fast, while authed) so a quick
        // logout / account-switch can't strand it — photo uploads are slow, and if
        // they ran first the row could be lost. Strip not-yet-uploaded local file://
        // paths from this first write (useless to other devices); fill in the real
        // Storage URLs with a second upsert once the uploads finish.
        const pending = toSync as Listing | null; // assigned in the setS closure
        if (pending) {
          const l = pending;
          capture('listing_posted', { category: l.cat, condition: l.cond, photos: (l.photos ?? []).length }, { set: { has_listed: true }, setOnce: { first_listed_at: new Date().toISOString() } });
          track((async () => {
            if (deletedListings.has(l.id)) return; // deleted before we even started
            const remote = (l.photos ?? []).filter((p) => /^https?:\/\//.test(p));
            await upsertListing({ ...l, photos: remote });
            const photos = await uploadListingPhotos(l.ownerId, l.id, l.photos ?? []);
            if (deletedListings.has(l.id)) return; // deleted during the slow upload — don't resurrect it
            // use the CURRENT listing for the upsert, not the stale submit-time snapshot —
            // taken/takenBy may have changed during the slow upload and must not be reverted.
            let current: Listing | undefined;
            setS((p) => {
              current = p.listings.find((x) => x.id === l.id);
              return { ...p, listings: p.listings.map((x) => (x.id === l.id ? { ...x, photos } : x)) };
            });
            await upsertListing({ ...(current ?? l), photos });
            // some photos failed to upload (dropped, not persisted as broken file:// paths) — tell the user
            const dropped = (l.photos?.length ?? 0) - photos.length;
            if (dropped > 0) {
              setS((p) => ({ ...p, dialog: { title: translate(p.lang, 'post.photoFailTitle'), message: translate(p.lang, 'post.photoFailBody'), actions: [{ label: 'OK', kind: 'primary' }] } }));
            }
          })());
        }
        return outId;
      },

      deleteListing: (id) => {
        const listing = s.listings.find((l) => l.id === id) ?? null;
        deletedListings.add(id); // stop any in-flight edit upsert from re-creating it
        setS((prev) => ({
          ...prev,
          listings: prev.listings.filter((l) => l.id !== id),
          requests: prev.requests.filter((r) => r.listingId !== id),
          threads: Object.fromEntries(Object.entries(prev.threads).filter(([tid]) => !tid.startsWith(`${id}:`))),
          takenPickerId: prev.takenPickerId === id ? null : prev.takenPickerId,
          activeListingId: prev.activeListingId === id ? null : prev.activeListingId,
        }));
        // remove the row (children cascade), then its Storage images (client-side —
        // Supabase blocks DB-side storage deletes). Photo cleanup is best-effort and
        // must NOT block logout, so it's not tracked.
        if (listing) {
          track(deleteListingRemote(listing));
          // Keep any photo still referenced by a handoff snapshot so "My impact"
          // hand-offs keep showing the image after the listing is deleted.
          const keepPhotos = new Set(
            (s.handoffs ?? []).filter((h) => h.listingId === id && h.photo).map((h) => h.photo as string)
          );
          void deleteListingPhotos(listing, keepPhotos);
        }
      },

      // send a request to the owner. If a chat with them already exists, the request
      // also drops into that thread as a message (so it shows under Chats, not Requests).
      requestListing: (listingId, note) => {
        if (!s.currentUserId) return;
        const l = s.listings.find((x) => x.id === listingId);
        if (!l) return;
        if (l.ownerId === s.currentUserId) return; // can't request your own listing
        if (s.requests.some((r) => r.listingId === listingId && r.fromUserId === s.currentUserId)) return;
        const now = Date.now();
        const text = note.trim() || `Hi! Is the ${l.title} still available?`;
        const req: Request = { id: uuid(), listingId, fromUserId: s.currentUserId, toUserId: l.ownerId, note: text, createdAt: now, status: 'pending', title: l.title, photo: l.photos?.[0], tint: l.tint, cat: l.cat };
        const tid = threadId(s.currentUserId, l.ownerId);
        const hasThread = !!s.threads[tid];
        const msg: Message | null = hasThread ? { id: uuid(), from: s.currentUserId, text, ts: now } : null;
        setS((prev) => {
          const threads = hasThread && msg ? { ...prev.threads, [tid]: [...(prev.threads[tid] ?? []), msg] } : prev.threads;
          const threadListing = hasThread ? { ...prev.threadListing, [tid]: listingId } : prev.threadListing;
          const threadStarter = hasThread ? { ...prev.threadStarter, [tid]: prev.threadStarter[tid] ?? prev.currentUserId } : prev.threadStarter;
          const threadAccepted = hasThread ? { ...prev.threadAccepted, [tid]: true } : prev.threadAccepted;
          return {
            ...prev,
            requests: [req, ...prev.requests],
            threads,
            threadListing,
            threadStarter,
            threadAccepted,
            // local echo only; the recipient is notified server-side via a DB trigger
            notifications: [
              notify(prev, { userId: l.ownerId, kind: hasThread ? 'message' : 'request', title: `${userName(prev, prev.currentUserId)} wants your ${l.title}`, body: text, threadId: hasThread ? tid : undefined, listingId, route: hasThread ? '/thread' : '/manage' }),
              ...prev.notifications,
            ],
          };
        });
        track(insertRequest(req));
        capture('listing_requested', { listingId }, { set: { has_requested: true }, setOnce: { first_requested_at: new Date().toISOString() } });
        if (hasThread && msg) {
          // await thread upsert before the message so m_ins RLS (thread must exist) passes
          track((async () => {
            await upsertThread(tid, { listingId, starter: s.threadStarter[tid] ?? s.currentUserId, accepted: true });
            await insertMessage(tid, msg);
          })());
        }
      },

      // owner accepts -> opens a shared thread (seeded with the requester's note) for both
      acceptRequest: (requestId) => {
        const req = s.requests.find((r) => r.id === requestId);
        if (!req) return;
        if (req.status !== 'pending') return; // already cancelled/accepted/declined — can't act
        const id = threadId(req.toUserId, req.fromUserId);
        const l = s.listings.find((x) => x.id === req.listingId);
        const seed: Message = { id: uuid(), from: req.fromUserId, text: req.note, ts: req.createdAt };
        const accept: Message = { id: uuid(), from: req.toUserId, text: `Accepted your request for ${l?.title ?? 'the item'}. Let's arrange the pickup!`, ts: Date.now() };
        setS((prev) => {
          const existing = prev.threads[id] ?? [];
          const msgs = existing.length === 0 ? [seed, accept] : [...existing, accept];
          return {
            ...prev,
            requests: prev.requests.map((r) => (r.id === requestId ? { ...r, status: 'accepted' } : r)),
            threads: { ...prev.threads, [id]: msgs },
            threadListing: { ...prev.threadListing, [id]: req.listingId },
            threadStarter: { ...prev.threadStarter, [id]: prev.threadStarter[id] ?? req.fromUserId },
            threadAccepted: { ...prev.threadAccepted, [id]: true },
            notifications: [
              notify(prev, { userId: req.fromUserId, kind: 'request', title: `${userName(prev, req.toUserId)} accepted your request`, body: `You can now chat about ${l?.title ?? 'the item'}.`, threadId: id, listingId: req.listingId, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        });
        track(updateRequestStatus(requestId, 'accepted', true)); // pending-only: never overrides a cancel
        capture('request_accepted', { listingId: req.listingId });
        track((async () => {
          await upsertThread(id, { listingId: req.listingId, starter: s.threadStarter[id] ?? req.fromUserId, accepted: true });
          // note: the requester's note isn't re-inserted as a message — RLS only lets
          // a user insert their own messages, and it already lives on the request row
          await insertMessage(id, accept);
        })());
      },

      declineRequest: (requestId) => {
        const cur = s.requests.find((r) => r.id === requestId);
        if (!cur || cur.status !== 'pending') return; // can't decline a withdrawn/resolved request
        setS((prev) => {
          const req = prev.requests.find((r) => r.id === requestId);
          if (!req) return prev;
          return {
            ...prev,
            requests: prev.requests.map((r) => (r.id === requestId ? { ...r, status: 'declined' } : r)),
            notifications: [
              notify(prev, { userId: req.fromUserId, kind: 'request', title: `${userName(prev, req.toUserId)} declined your request`, body: '', listingId: req.listingId }),
              ...prev.notifications,
            ],
          };
        });
        track(updateRequestStatus(requestId, 'declined', true)); // pending-only: never overrides a cancel
      },

      // remove a request (pending or accepted). Removing an accepted one un-reserves
      // the listing, so it returns to the public feed. The other party gets a neutral
      // notice — the reason is kept private (it drives the follow-up block prompt).
      cancelRequest: (requestId, _reason) => {
        if (!s.requests.some((r) => r.id === requestId)) return;
        // soft-cancel: mark 'cancelled' so the DB trigger notifies the other party
        // cross-device; remove it from our own list. The listing relists (not accepted).
        // also dismiss it locally so a cold pull (which reloads the still-present 'cancelled'
        // row) can't resurface it in the Requested tab.
        setS((prev) => ({ ...prev, requests: prev.requests.filter((r) => r.id !== requestId), dismissedRequests: { ...prev.dismissedRequests, [requestId]: true }, cancelTarget: null }));
        track(updateRequestStatus(requestId, 'cancelled'));
      },

      openCancelReason: (requestId, role) => setS((prev) => ({ ...prev, cancelTarget: { requestId, role } })),
      closeCancelReason: () => setS((prev) => ({ ...prev, cancelTarget: null })),

      // silently drop a request from my list (no notification) — used once a deal is
      // settled (item given) or already declined, just to clear it off the screen
      removeRequest: (requestId) => {
        setS((prev) => ({
          ...prev,
          requests: prev.requests.filter((r) => r.id !== requestId),
          dismissedRequests: { ...prev.dismissedRequests, [requestId]: true }, // stays gone across pull/realtime
        }));
        track(deleteRequestRemote(requestId));
      },

      openThreadFor: (listingId) => {
        const l = s.listings.find((x) => x.id === listingId);
        // never start a chat with yourself, when logged out, or for an unknown listing
        if (!l || !s.currentUserId) return s.activeThreadId ?? '';
        const otherId = l.ownerId;
        if (otherId === s.currentUserId) return s.activeThreadId ?? '';
        const id = threadId(s.currentUserId, otherId);
        setS((prev) => {
          const { threads, threadListing } = ensurePairThread(prev, otherId, listingId);
          // remember who reached out first so the recipient can accept/decline the chat
          const threadStarter = prev.threadStarter[id]
            ? prev.threadStarter
            : { ...prev.threadStarter, [id]: prev.currentUserId };
          return {
            ...prev,
            threads,
            threadListing,
            threadStarter,
            activeThreadId: id,
            replyDraft: null,
            notifications: prev.notifications.map((n) => (n.userId === prev.currentUserId && n.threadId === id ? { ...n, read: true } : n)),
          };
        });
        track(upsertThread(id, { listingId, starter: s.threadStarter[id] ?? s.currentUserId }));
        track(markThreadRead(s.currentUserId, id)); // clear unread persistently
        return id;
      },

      // open (or create a fresh, empty) conversation with a person directly — used by
      // "Message" on a profile. Unlike openThreadFor this needs NO listing, so it works
      // even when that person has no live listings. No server write until a message is
      // actually sent (sendMsg upserts the thread first), so we never leave empty rows.
      openThreadWith: (personId) => {
        if (!s.currentUserId || !personId || personId === s.currentUserId) return s.activeThreadId ?? '';
        const id = threadId(s.currentUserId, personId);
        setS((prev) => {
          const { threads, threadListing } = ensurePairThread(prev, personId);
          const threadStarter = prev.threadStarter[id] ? prev.threadStarter : { ...prev.threadStarter, [id]: prev.currentUserId };
          return {
            ...prev,
            threads,
            threadListing,
            threadStarter,
            activeThreadId: id,
            replyDraft: null,
            notifications: prev.notifications.map((n) => (n.userId === prev.currentUserId && n.threadId === id ? { ...n, read: true } : n)),
          };
        });
        return id;
      },

      openThread: (id) => {
        setS((prev) => ({
          ...prev,
          activeThreadId: id,
          replyDraft: null, // a reply-in-progress doesn't carry across threads
          notifications: prev.notifications.map((n) =>
            n.userId === prev.currentUserId && n.threadId === id ? { ...n, read: true } : n
          ),
        }));
        // persist the read so the unread dot doesn't return after re-login
        if (s.currentUserId) track(markThreadRead(s.currentUserId, id));
      },

      deleteThread: (id) => {
        // cutoff = newest message I currently see (same time-base as messages, so it
        // hides every seen message and nothing newer). Date.now() only for an empty
        // chat — NOT max(now, ...): a client clock ahead of the server would otherwise
        // hide a brand-new incoming message whose server time is below my wall clock.
        const msgs = s.threads[id] ?? [];
        const upTo = msgs.length ? msgs[msgs.length - 1].ts : Date.now();
        setS((prev) => ({
          ...prev,
          // drop the messages (hides it from the inbox), record my cutoff, but KEEP the
          // thread metadata so a genuinely-new message can revive the chat with context.
          threads: Object.fromEntries(Object.entries(prev.threads).filter(([k]) => k !== id)),
          threadCleared: { ...prev.threadCleared, [id]: upTo },
          activeThreadId: prev.activeThreadId === id ? null : prev.activeThreadId,
          notifications: prev.notifications.filter((n) => n.threadId !== id),
        }));
        // delete the chat for ME only — stamp my cleared marker so it stays gone across
        // re-login, while the other person's copy is untouched (no row/message delete)
        track(clearThreadForMe(id, s.currentUserId, upTo));
      },

      acceptThread: (id) => {
        setS((prev) => ({ ...prev, threadAccepted: { ...prev.threadAccepted, [id]: true } }));
        track(upsertThread(id, { accepted: true }));
      },

      // stamp that the current user has seen this thread up to now (for read receipts)
      markThreadRead: (id) => {
        const ts = Date.now();
        setS((prev) => ({
          ...prev,
          threadRead: { ...prev.threadRead, [id]: { ...(prev.threadRead[id] ?? {}), [prev.currentUserId]: ts } },
          // also clear this thread's message notifications — the DB trigger re-flags them
          // unread on every new message, so viewing the thread must keep clearing them.
          notifications: prev.notifications.map((n) => (n.userId === prev.currentUserId && n.threadId === id ? { ...n, read: true } : n)),
        }));
        track(updateThreadRead(id, s.currentUserId, ts));
        if (s.currentUserId) track(markThreadRead(s.currentUserId, id)); // repo: persist notif read for this thread
      },

      // text is passed in from the composer's local state so typing never touches
      // global state (which would re-render every screen on each keystroke)
      sendMsg: (text) => {
        const id = s.activeThreadId;
        const body = text.trim();
        if (!id || !body) return;
        const msg: Message = { id: uuid(), from: s.currentUserId, text: body, ts: Date.now(), replyTo: s.replyDraft ?? undefined };
        const starter = s.threadStarter[id] ?? s.currentUserId;
        const accepts = starter !== s.currentUserId; // replying accepts a cold DM
        capture('message_sent');
        setS((prev) => {
          const other = otherInThread(prev, id);
          const meta = threadMeta(prev, id);
          const threadStarter = prev.threadStarter[id] ? prev.threadStarter : { ...prev.threadStarter, [id]: starter };
          const threadAccepted = accepts ? { ...prev.threadAccepted, [id]: true } : prev.threadAccepted;
          return {
            ...prev,
            replyDraft: null, // consumed
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            threadStarter,
            threadAccepted,
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: text, threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        });
        track((async () => {
          await upsertThread(id, { starter, accepted: accepts ? true : undefined });
          await insertMessage(id, msg);
        })());
      },

      shareLoc: async () => {
        const id = s.activeThreadId;
        if (!id) return;
        let coords: { latitude: number; longitude: number } | null = null;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coords = pos.coords;
          }
        } catch {}
        // never send a "shared my location" message without a real fix — that would mislead
        // the other person. Tell the user to enable location instead.
        if (!coords) {
          setS((prev) => ({ ...prev, dialog: { title: translate(prev.lang, 'thread.locFailTitle'), message: translate(prev.lang, 'thread.locFailBody'), actions: [{ label: 'OK', kind: 'primary' }] } }));
          return;
        }
        const text = `My live location: https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
        const msg: Message = { id: uuid(), from: s.currentUserId, text, ts: Date.now(), replyTo: s.replyDraft ?? undefined };
        setS((prev) => {
          const other = otherInThread(prev, id);
          const meta = threadMeta(prev, id);
          return {
            ...prev,
            replyDraft: null, // consumed
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: 'Shared a live location', threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        });
        await track(upsertThread(id, { starter: s.threadStarter[id] ?? s.currentUserId, accepted: true }));
        await track(insertMessage(id, msg));
      },

      sendImage: (uri) => {
        const id = s.activeThreadId;
        if (!id) return;
        const msgId = uuid();
        const msg: Message = { id: msgId, from: s.currentUserId, text: '', image: uri, ts: Date.now(), replyTo: s.replyDraft ?? undefined };
        setS((prev) => {
          const other = otherInThread(prev, id);
          const meta = threadMeta(prev, id);
          return {
            ...prev,
            replyDraft: null, // consumed
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: 'Sent a photo', threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        });
        track((async () => {
          const folder = id.replace(/[^a-zA-Z0-9]/g, '_');
          const url = await uploadImage(uri, 'chat-images', `${s.currentUserId}/${folder}/${uuid()}.jpg`);
          // deleted mid-upload → don't resurrect the row; drop the file we just uploaded
          if (deletedMessages.has(msgId)) {
            if (url) await deleteChatImage(url);
            return;
          }
          const image = url ?? uri;
          if (url) setS((prev) => ({ ...prev, threads: { ...prev.threads, [id]: (prev.threads[id] ?? []).map((m) => (m.id === msgId ? { ...m, image } : m)) } }));
          await upsertThread(id, { starter: s.threadStarter[id] ?? s.currentUserId, accepted: true });
          await insertMessage(id, { ...msg, image });
        })());
      },

      // long-press a message → delete it for everyone (WhatsApp-style). Only the
      // sender can delete their own message; the m_del RLS policy enforces it too.
      deleteMessage: (msgId) => {
        const id = s.activeThreadId;
        if (!id) return;
        const msg = (s.threads[id] ?? []).find((m) => m.id === msgId);
        if (!msg || msg.from !== s.currentUserId) return;
        deletedMessages.add(msgId); // block any in-flight upload→insert from re-creating it
        setS((prev) => ({
          ...prev,
          threads: { ...prev.threads, [id]: (prev.threads[id] ?? []).filter((m) => m.id !== msgId) },
          // if I was replying to this very message, drop the stale reply draft
          replyDraft: prev.replyDraft?.id === msgId ? null : prev.replyDraft,
        }));
        track((async () => {
          // remove the image from Storage too (best-effort; only my own uid folder is deletable)
          if (msg.image && /\/chat-images\//.test(msg.image)) await deleteChatImage(msg.image);
          await deleteMessageRemote(msgId);
        })());
      },

      // swipe a message → queue it as the reply target. Snapshot a display snippet now
      // so the quote survives even if the original is later deleted.
      setReply: (msgId) => {
        if (!msgId) {
          setS((prev) => ({ ...prev, replyDraft: null }));
          return;
        }
        const id = s.activeThreadId;
        const m = id ? (s.threads[id] ?? []).find((x) => x.id === msgId) : null;
        if (!m) return;
        const text = m.text?.trim() ? m.text.trim() : m.image ? `📷 ${translate(s.lang, 'thread.photo')}` : '';
        setS((prev) => ({ ...prev, replyDraft: { id: m.id, text, from: m.from } }));
      },

      blockUser: (id) => {
        if (!s.currentUserId) return;
        setS((prev) => ({ ...prev, blocked: { ...prev.blocked, [blockKey(prev.currentUserId, id)]: true } }));
        track(addBlock(s.currentUserId, id));
      },
      unblockUser: (id) => {
        if (!s.currentUserId) return;
        setS((prev) => ({ ...prev, blocked: { ...prev.blocked, [blockKey(prev.currentUserId, id)]: false } }));
        track(removeBlock(s.currentUserId, id));
      },

      openTakenPicker: (listingId) => setS((prev) => ({ ...prev, takenPickerId: listingId })),

      confirmTaken: (listingId, recipientId) => {
        const src = s.listings.find((x) => x.id === listingId);
        // snapshot the hand-off (persists even if the listing is later deleted)
        const handoff: Handoff | null = src
          ? { id: uuid(), listingId, giverId: s.currentUserId, recipientId: recipientId ?? '', title: src.title, photo: src.photos?.[0], tint: src.tint, cat: src.cat, ts: Date.now() }
          : null;
        // sync taken state + handoff row to Supabase
        track(setListingTaken(listingId, recipientId));
        capture('item_given', { listingId });
        if (handoff) track(insertHandoff(handoff));
        // every OTHER requester loses the deal — decline their request so they no longer
        // see the exact pickup address (detail gates exact on their request being 'accepted').
        const losers = s.requests.filter((r) => r.listingId === listingId && r.fromUserId !== recipientId && (r.status === 'pending' || r.status === 'accepted')).map((r) => r.id);
        losers.forEach((id) => track(updateRequestStatus(id, 'declined')));
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === listingId);
          if (!l || !handoff) return prev;
          const listings = prev.listings.map((x) => (x.id === listingId ? { ...x, taken: true, takenBy: recipientId ?? undefined } : x));
          return {
            ...prev,
            listings,
            requests: prev.requests.map((r) => (losers.includes(r.id) ? { ...r, status: 'declined' } : r)),
            handoffs: [handoff, ...(prev.handoffs ?? [])],
            takenPickerId: null,
            // only notify a real recipient (external "given to someone outside Daata" has none)
            notifications: recipientId
              ? [
                  notify(prev, {
                    userId: recipientId,
                    kind: 'taken',
                    title: `${userName(prev, prev.currentUserId)} marked "${l.title}" as taken by you`,
                    body: 'Please rate your experience.',
                    listingId,
                    route: '/rate',
                  }),
                  ...prev.notifications,
                ]
              : prev.notifications,
          };
        });
      },

      openRate: (n) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === n.listingId);
          return {
            ...prev,
            rateListingId: n.listingId ?? null,
            // fall back to the handoff snapshot's giver so rating still works after the listing is deleted
            rateGiverId: l?.ownerId ?? (prev.handoffs ?? []).find((h) => h.listingId === n.listingId)?.giverId ?? null,
            rating: 0,
            rateTags: [],
            reviewDraft: '',
            notifications: prev.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
          };
        }),

      startRateForListing: (listingId, rating = 0) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === listingId);
          return { ...prev, rateListingId: listingId, rateGiverId: l?.ownerId ?? (prev.handoffs ?? []).find((h) => h.listingId === listingId)?.giverId ?? null, rating, rateTags: [], reviewDraft: '' };
        }),

      submitRate: () => {
        const dup = s.rateListingId
          ? (s.reviews ?? []).some((r) => r.from === s.currentUserId && r.listingId === s.rateListingId)
          : false;
        const review: Review | null =
          s.rateGiverId && !dup
            ? { id: uuid(), from: s.currentUserId, to: s.rateGiverId, listingId: s.rateListingId ?? undefined, rating: s.rating, tags: s.rateTags, text: s.reviewDraft.trim(), ts: Date.now() }
            : null;
        setS((prev) => ({
          ...prev,
          reviews: review ? [review, ...(prev.reviews ?? [])] : prev.reviews,
          rateListingId: null,
          rateGiverId: null,
          rating: 0,
          rateTags: [],
          reviewDraft: '',
        }));
        if (review) track(insertReview(review));
      },

      toggleRateTag: (t) =>
        setS((prev) => ({
          ...prev,
          rateTags: prev.rateTags.includes(t) ? prev.rateTags.filter((x) => x !== t) : [...prev.rateTags, t],
        })),

      markNotifsRead: () => {
        setS((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => (n.userId === prev.currentUserId ? { ...n, read: true } : n)),
        }));
        track(markNotificationsRead(s.currentUserId));
      },

      deleteNotif: (id) => {
        setS((prev) => ({ ...prev, notifications: prev.notifications.filter((n) => n.id !== id) }));
        track(deleteNotificationRemote(id));
      },
      clearNotifs: () => {
        setS((prev) => ({ ...prev, notifications: prev.notifications.filter((n) => n.userId !== prev.currentUserId) }));
        track(clearNotificationsRemote(s.currentUserId));
      },

      openNotif: (n) => {
        // already reviewed this item -> show the review on the giver's profile, don't re-open the form
        const reviewedTaken = n.kind === 'taken' && hasReviewed(s, n.listingId);
        const route: string | null = reviewedTaken ? '/giver' : n.route ?? null;
        setS((prev) => {
          const upd = prev.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x));
          if (reviewedTaken) {
            const l = prev.listings.find((x) => x.id === n.listingId);
            return { ...prev, notifications: upd, activePersonId: l?.ownerId ?? null };
          }
          if (n.kind === 'taken') {
            const l = prev.listings.find((x) => x.id === n.listingId);
            return { ...prev, notifications: upd, rateListingId: n.listingId ?? null, rateGiverId: l?.ownerId ?? (prev.handoffs ?? []).find((h) => h.listingId === n.listingId)?.giverId ?? null, rating: 0, rateTags: [], reviewDraft: '' };
          }
          if (n.threadId) return { ...prev, notifications: upd, activeThreadId: n.threadId };
          if (n.listingId) return { ...prev, notifications: upd, activeListingId: n.listingId };
          return { ...prev, notifications: upd };
        });
        return route;
      },

      submitReport: () =>
        setS((prev) => {
          const listingId = prev.activeListingId;
          const l = listingId ? prev.listings.find((x) => x.id === listingId) : null;
          if (!listingId || !l || prev.reportReason == null) return { ...prev, reportDone: true };
          // email the report — nothing is stored except a per-listing tally
          deliverReport({
            listingId,
            listingTitle: l.title,
            reason: REPORT_REASONS[prev.reportReason] ?? `Reason #${prev.reportReason}`,
            reportedBy: userName(prev, prev.currentUserId),
            ts: Date.now(),
          });
          // count THIS listing only; it auto-delists once it crosses the threshold
          track(reportListingRemote(listingId));
          const reportCounts = { ...prev.reportCounts, [listingId]: (prev.reportCounts[listingId] ?? 0) + 1 };
          return { ...prev, reportCounts, reportDone: true };
        }),
      markOnboarded: () => setS((prev) => (prev.onboarded ? prev : { ...prev, onboarded: true })),
      recordNotifyNudge: () => setS((prev) => ({ ...prev, notifyNudgeDate: new Date().toISOString().slice(0, 10) })),

      setName: (name) => {
        const finalName = name.trim() || userName(s, s.currentUserId);
        setS((prev) => ({
          ...prev,
          names: { ...prev.names, [prev.currentUserId]: finalName },
          profiles: { ...prev.profiles, [prev.currentUserId]: { ...(prev.profiles[prev.currentUserId] ?? { id: prev.currentUserId, dp: null }), name: finalName } },
        }));
        if (s.currentUserId) track(updateProfileRemote(s.currentUserId, { name: finalName }));
      },

      // name + gender + dob in one shot — used by onboarding (profile-setup) and the
      // Account edit screen. Persists to Supabase and tags the analytics person so
      // gender/age/age-band cohorts populate.
      saveProfileInfo: ({ name, gender, dob }) => {
        const me = s.currentUserId;
        const finalName = name.trim() || userName(s, me);
        setS((prev) => ({
          ...prev,
          names: { ...prev.names, [me]: finalName },
          profiles: { ...prev.profiles, [me]: { ...(prev.profiles[me] ?? { id: me, dp: null }), name: finalName, gender, dob } },
        }));
        if (me) {
          track(updateProfileRemote(me, { name: finalName, gender, dob }));
          const age = ageFromDob(dob);
          setPerson({
            gender: gender ?? undefined,
            age: age ?? undefined,
            age_band: ageBand(age) ?? undefined,
            birth_year: dob ? Number(dob.slice(0, 4)) : undefined,
          });
          capture('profile_completed', { hasGender: !!gender, hasDob: !!dob });
        }
      },
      setDp: (uri) => {
        const me = s.currentUserId;
        // optimistic: show the local uri, then upload + persist the public URL
        setS((prev) => ({
          ...prev,
          dp: { ...prev.dp, [me]: uri },
          profiles: { ...prev.profiles, [me]: { ...(prev.profiles[me] ?? { id: me, name: userName(prev, me) }), dp: uri } },
        }));
        if (!me) return;
        if (uri === null) {
          track(updateProfileRemote(me, { dp: null }));
          return;
        }
        track((async () => {
          const url = (await uploadImage(uri, 'avatars', `${me}/${uuid()}.jpg`)) ?? uri;
          setS((prev) => ({
            ...prev,
            dp: { ...prev.dp, [me]: url },
            profiles: { ...prev.profiles, [me]: { ...(prev.profiles[me] ?? { id: me, name: userName(prev, me) }), dp: url } },
          }));
          await updateProfileRemote(me, { dp: url });
        })());
      },

      setNotifyNear: (on) => {
        const next: NotifyPrefs = { ...DEFAULT_NOTIFY, ...s.notify[s.currentUserId], near: on };
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: next } }));
        if (s.currentUserId) track(upsertNotifyPrefs(s.currentUserId, next));
        // turning it on → make sure this device has a push token registered
        if (on && s.currentUserId) void registerForPush(s.currentUserId);
      },
      setNotifyChat: (on) => {
        const next: NotifyPrefs = { ...DEFAULT_NOTIFY, ...s.notify[s.currentUserId], chat: on };
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: next } }));
        if (s.currentUserId) track(upsertNotifyPrefs(s.currentUserId, next));
      },
      setNotifyAddress: (coords, label) => {
        const next: NotifyPrefs = { ...DEFAULT_NOTIFY, ...s.notify[s.currentUserId], addr: { lat: coords.lat, lng: coords.lng, label } };
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: next } }));
        if (s.currentUserId) track(upsertNotifyPrefs(s.currentUserId, next));
      },

      restart: () => setS({ ...INITIAL, hydrated: true }),

      showAlert: (title, message) =>
        setS((prev) => ({ ...prev, dialog: { title, message, actions: [{ label: 'OK', kind: 'primary' }] } })),
      showConfirm: ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive, onConfirm }) =>
        setS((prev) => ({
          ...prev,
          dialog: {
            title,
            message,
            actions: [
              { label: cancelLabel, kind: 'cancel' },
              { label: confirmLabel, kind: destructive ? 'destructive' : 'primary', onPress: onConfirm },
            ],
          },
        })),
      closeDialog: () => setS((prev) => ({ ...prev, dialog: null })),
    };
  }, [s]);

  // hydrate the AsyncStorage cache (instant cold-start paint; Supabase pull reconciles after)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
        if (alive) setS((prev) => ({ ...prev, ...saved, hydrated: true }));
      } catch {
        if (alive) setS((prev) => ({ ...prev, hydrated: true }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // offline outbox: flush queued writes on app foreground + once on launch
  useEffect(() => {
    initOutbox();
    void flushOutbox();
    void configureForegroundNotifications();
    // tapping a push notification → open the relevant listing
    let sub: { remove: () => void } | undefined;
    (async () => {
      if (isExpoGo) return; // expo-notifications throws on import in Expo Go
      try {
        const Notifications = await import('expo-notifications');
        sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          const data = resp.notification.request.content.data as { listingId?: string; threadId?: string; route?: string };
          if (data?.threadId) {
            // open the conversation + clear its unread (mark read locally AND in the DB
            // so the dot doesn't return after re-login). uid comes from the session
            // because this listener was set up at mount when currentUserId was empty.
            const tid = data.threadId;
            setS((prev) => ({ ...prev, activeThreadId: tid, notifications: prev.notifications.map((x) => (x.threadId === tid ? { ...x, read: true } : x)) }));
            void supabase.auth.getUser().then(({ data: u }) => {
              const me = u.user?.id;
              if (me) void track(markThreadRead(me, tid));
            });
          } else if (data?.listingId) {
            setS((prev) => ({ ...prev, activeListingId: data.listingId as string }));
          }
          try {
            router.navigate((data?.route ?? '/feed') as Parameters<typeof router.navigate>[0]);
          } catch {}
        });
      } catch {
        /* native module unavailable — ignore */
      }
    })();
    return () => sub?.remove();
  }, []);

  // auth: mirror the Supabase session into the store + bootstrap the profile row
  useEffect(() => {
    const applyUser = async (userId: string | null, pull: boolean) => {
      if (!userId) {
        setS((prev) => ({ ...prev, currentUserId: '', currentUserEmail: '', authReady: true }));
        return;
      }
      setS((prev) => ({ ...prev, currentUserId: userId, authReady: true }));
      // register this device for "new items near you" push on real sign-in
      if (pull) void registerForPush(userId);
      try {
        const email = (await supabase.auth.getUser()).data.user?.email ?? '';
        setS((prev) => ({ ...prev, currentUserEmail: email }));
        if (pull) identifyUser(userId, email ? { email } : undefined); // tie analytics to this user (enables retention)
        // safety net in case the signup trigger didn't run (keeps existing row)
        await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
        const { data } = await supabase
          .from('profiles')
          .select('id,name,city_id,dp,since,gender,dob')
          .eq('id', userId)
          .single();
        if (data) {
          setS((prev) => ({
            ...prev,
            // onboarding is per-user, derived from server state: a profile with a
            // city means they've completed onboarding (monotonic — never un-sets)
            onboarded: prev.onboarded || !!data.city_id,
            profiles: {
              ...prev.profiles,
              [userId]: {
                id: data.id,
                name: data.name || email.split('@')[0] || 'You',
                cityId: data.city_id,
                dp: data.dp,
                since: data.since,
                gender: data.gender ?? null,
                dob: data.dob ?? null,
              },
            },
          }));
          // tag the analytics person with demographics so cohorts/age/gender segments work
          if (pull) {
            const age = ageFromDob(data.dob);
            setPerson({
              gender: data.gender ?? undefined,
              age: age ?? undefined,
              age_band: ageBand(age) ?? undefined,
              birth_year: data.dob ? Number(String(data.dob).slice(0, 4)) : undefined,
              city: data.city_id ? CITIES.find((c) => c.id === data.city_id)?.name ?? data.city_id : undefined,
            });
          }
          // on real sign-in, browse their saved home city by default so the feed shows
          // the right city's products (survives logout/login + fresh-device installs)
          if (pull && data.city_id) {
            setS((prev) => ({ ...prev, activeCityId: data.city_id as string, activeMode: 'city' }));
          }
        }
        // only do the heavy full pull on real sign-in — NOT on every token refresh
        // (which would periodically clobber in-flight optimistic/offline writes)
        if (!pull) return;
        // drain any offline-queued writes FIRST so the pull below includes them
        // (otherwise the wholesale replace could drop not-yet-synced local rows)
        await flushOutbox();
        // pull listings (source of truth) + the rest of the user's data
        const ls = await fetchListings();
        if (ls) setS((prev) => ({ ...prev, listings: ls }));
        const ud = await pullUserData(userId);
        const refIds = new Set<string>();
        (ls ?? []).forEach((l) => refIds.add(l.ownerId));
        if (ud) {
          setS((prev) => ({
            ...prev,
            requests: ud.requests,
            threads: ud.bundle.threads,
            threadListing: ud.bundle.threadListing,
            threadStarter: ud.bundle.threadStarter,
            threadAccepted: ud.bundle.threadAccepted,
            threadRead: ud.bundle.threadRead,
            threadCleared: ud.bundle.threadCleared,
            reviews: ud.reviews,
            handoffs: ud.handoffs,
            saved: Object.fromEntries(ud.saves.map((sid) => [sid, true])),
            blocked: Object.fromEntries(ud.blocks.map((k) => [k, true])),
            notify: { ...prev.notify, [userId]: ud.notify ?? DEFAULT_NOTIFY },
            notifications: ud.notifications,
          }));
          ud.requests.forEach((r) => { refIds.add(r.fromUserId); refIds.add(r.toUserId); });
          Object.keys(ud.bundle.threads).forEach((tid) => threadUsers(tid).forEach((u) => refIds.add(u)));
          ud.reviews.forEach((r) => { refIds.add(r.from); refIds.add(r.to); });
          ud.handoffs.forEach((h) => { refIds.add(h.giverId); refIds.add(h.recipientId); });
          // blocked users may have no chat/listing — pull their profiles so the Blocked
          // list shows real names/avatars instead of "Someone".
          ud.blocks.forEach((k) => { const [a, b] = k.split('>'); refIds.add(a); refIds.add(b); });
        }
        const profs = await fetchProfiles([...refIds]);
        if (profs.length) setS((prev) => ({ ...prev, profiles: { ...prev.profiles, ...Object.fromEntries(profs.map((p) => [p.id, p])) } }));
        // we're authed + online — drain any writes queued while offline
        void flushOutbox();
      } catch {
        // offline / transient — the cache + fallback name keep the UI usable
      }
    };
    // onAuthStateChange fires INITIAL_SESSION on mount, so no separate getSession needed.
    // Full pull only on sign-in/initial; token refresh & user updates just refresh identity.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const pull = event === 'INITIAL_SESSION' || event === 'SIGNED_IN';
      applyUser(session?.user.id ?? null, pull);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // realtime: keep listings, chat, requests & notifications live across devices
  useEffect(() => {
    const me = s.currentUserId;
    if (!me) return;
    const ensureProfile = (id: string) => {
      if (id && !s.profiles[id]) {
        fetchProfiles([id]).then((ps) => {
          if (ps.length) setS((prev) => ({ ...prev, profiles: { ...prev.profiles, [ps[0].id]: ps[0] } }));
        });
      }
    };
    const ch = supabase
      .channel('rt-' + me)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          setS((prev) => ({ ...prev, listings: prev.listings.filter((l) => l.id !== id) }));
          return;
        }
        const row = rowToListing(payload.new as Record<string, unknown>);
        setS((prev) => {
          const exists = prev.listings.some((l) => l.id === row.id);
          return { ...prev, listings: exists ? prev.listings.map((l) => (l.id === row.id ? row : l)) : [row, ...prev.listings] };
        });
        ensureProfile(row.ownerId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Record<string, any>;
        const tid: string = m.thread_id;
        if (!threadUsers(tid).includes(me)) return; // only my threads (id-dedupe below handles my own echo + multi-device)
        const msg = rowToMessage(m);
        setS((prev) => {
          // a chat I cleared stays gone for messages at/before my cutoff (e.g. a late /
          // outbox-replayed OLD message); a genuinely-newer message (ts > cutoff) revives it
          const cut = prev.threadCleared[tid];
          if (cut && msg.ts <= cut) return prev;
          const arr = prev.threads[tid] ?? [];
          // own optimistic echo already present: reconcile its local ts to the SERVER ts so
          // read-receipt comparisons (otherLastRead >= ts) use one clock — avoids skew
          // hiding or wrongly showing the read tick.
          if (arr.some((x) => x.id === msg.id)) {
            const merged = arr.map((x) => (x.id === msg.id ? { ...x, ts: msg.ts } : x)).sort((a, b) => a.ts - b.ts);
            return { ...prev, threads: { ...prev.threads, [tid]: merged } };
          }
          // keep messages ts-ordered: a replayed/clock-skewed insert can arrive after newer ones
          const next = [...arr, msg].sort((a, b) => a.ts - b.ts);
          return { ...prev, threads: { ...prev.threads, [tid]: next } };
        });
        ensureProfile(m.from_user);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        // someone deleted a message → drop it here too (replica identity is full, so
        // payload.old carries thread_id; fall back to scanning all threads if absent)
        const old = payload.old as { id?: string; thread_id?: string };
        const mid = old.id;
        if (!mid) return;
        deletedMessages.add(mid); // a delete from my OTHER device must also block any in-flight upload→insert here
        setS((prev) => {
          const tid = old.thread_id;
          if (tid && prev.threads[tid]) {
            return { ...prev, threads: { ...prev.threads, [tid]: prev.threads[tid].filter((x) => x.id !== mid) } };
          }
          let changed = false;
          const next: Record<string, Message[]> = {};
          for (const [k, arr] of Object.entries(prev.threads)) {
            const f = arr.filter((x) => x.id !== mid);
            if (f.length !== arr.length) changed = true;
            next[k] = f;
          }
          return changed ? { ...prev, threads: next } : prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          setS((prev) => ({ ...prev, requests: prev.requests.filter((r) => r.id !== id) }));
          return;
        }
        const r = rowToRequest(payload.new as Record<string, unknown>);
        if (r.fromUserId !== me && r.toUserId !== me) return;
        // a cancelled request drops off both parties' lists
        if (r.status === 'cancelled') {
          setS((prev) => ({ ...prev, requests: prev.requests.filter((x) => x.id !== r.id) }));
          return;
        }
        setS((prev) => {
          if (prev.dismissedRequests?.[r.id]) return prev; // user removed it — never resurrect
          const exists = prev.requests.some((x) => x.id === r.id);
          return { ...prev, requests: exists ? prev.requests.map((x) => (x.id === r.id ? r : x)) : [r, ...prev.requests] };
        });
        ensureProfile(r.fromUserId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          // a thread deleted on another device → remove it here too
          const id = (payload.old as { id?: string }).id;
          if (id) {
            setS((prev) => ({
              ...prev,
              threads: Object.fromEntries(Object.entries(prev.threads).filter(([k]) => k !== id)),
              threadListing: Object.fromEntries(Object.entries(prev.threadListing).filter(([k]) => k !== id)),
              threadStarter: Object.fromEntries(Object.entries(prev.threadStarter).filter(([k]) => k !== id)),
              threadAccepted: Object.fromEntries(Object.entries(prev.threadAccepted).filter(([k]) => k !== id)),
              threadRead: Object.fromEntries(Object.entries(prev.threadRead).filter(([k]) => k !== id)),
              activeThreadId: prev.activeThreadId === id ? null : prev.activeThreadId,
              notifications: prev.notifications.filter((n) => n.threadId !== id),
            }));
          }
          return;
        }
        const t = payload.new as Record<string, any>;
        const tid: string = t.id;
        if (!threadUsers(tid).includes(me)) return;
        // keep accepted state + read receipts + my "delete chat" cutoff live across devices
        setS((prev) => {
          // always sync MY cleared cutoff (e.g. a delete on my other device) so the
          // messages-INSERT filter enforces it here too
          const myClearedRaw = me === t.user_a ? t.cleared_a : t.cleared_b;
          const threadCleared = myClearedRaw ? { ...prev.threadCleared, [tid]: Date.parse(myClearedRaw) } : prev.threadCleared;
          // but don't resurrect accepted/read/listing metadata for a chat I've deleted
          // locally — a genuinely-new message revives it via the messages INSERT channel
          if (prev.threads[tid] === undefined) return threadCleared === prev.threadCleared ? prev : { ...prev, threadCleared };
          const rr: Record<string, number> = { ...(prev.threadRead[tid] ?? {}) };
          if (t.read_a) rr[t.user_a] = Date.parse(t.read_a);
          if (t.read_b) rr[t.user_b] = Date.parse(t.read_b);
          return {
            ...prev,
            threadCleared,
            threadAccepted: { ...prev.threadAccepted, [tid]: !!t.accepted },
            threadListing: t.listing_id ? { ...prev.threadListing, [tid]: t.listing_id } : prev.threadListing,
            threadRead: { ...prev.threadRead, [tid]: rr },
          };
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const p = payload.new as Record<string, any>;
        if (!p.id) return;
        // refresh cached name/dp/city/gender/dob when any cached user updates their
        // profile. MUST carry gender/dob — else our own update echoes back and wipes
        // them locally (form would show deselected on re-entry).
        setS((prev) =>
          prev.profiles[p.id]
            ? { ...prev, profiles: { ...prev.profiles, [p.id]: { ...prev.profiles[p.id], id: p.id, name: p.name || 'Someone', cityId: p.city_id, dp: p.dp, since: p.since, gender: p.gender ?? prev.profiles[p.id]?.gender ?? null, dob: p.dob ?? prev.profiles[p.id]?.dob ?? null } } }
            : prev
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, (payload) => {
        // listen to UPDATE too: message notifications are coalesced server-side (one
        // row per thread, updated with each new message) — so an UPDATE must refresh
        // the existing local entry, not add a duplicate.
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          setS((prev) => ({ ...prev, notifications: prev.notifications.filter((x) => x.id !== id) }));
          return;
        }
        const n = rowToNotification(payload.new as Record<string, unknown>);
        setS((prev) => {
          const exists = prev.notifications.some((x) => x.id === n.id);
          return { ...prev, notifications: exists ? prev.notifications.map((x) => (x.id === n.id ? n : x)) : [n, ...prev.notifications] };
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.currentUserId]);

  // persist (debounced so the JSON.stringify never blocks the tap that triggered it)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!s.hydrated) return;
    const snapshot = {
      currentUserId: s.currentUserId,
      currentUserEmail: s.currentUserEmail,
      profiles: s.profiles,
      lang: s.lang,
      listings: s.listings,
      requests: s.requests,
      dismissedRequests: s.dismissedRequests,
      threads: s.threads,
      threadListing: s.threadListing,
      threadStarter: s.threadStarter,
      threadAccepted: s.threadAccepted,
      threadRead: s.threadRead,
      threadCleared: s.threadCleared,
      notifications: s.notifications,
      reviews: s.reviews,
      handoffs: s.handoffs,
      reportCounts: s.reportCounts,
      saved: s.saved,
      blocked: s.blocked,
      notify: s.notify,
      dp: s.dp,
      names: s.names,
      radius: s.radius,
      activeMode: s.activeMode,
      activeCityId: s.activeCityId,
      userCity: s.userCity,
      onboarded: s.onboarded,
      notifyNudgeDate: s.notifyNudgeDate,
      safetyHidden: s.safetyHidden,
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    s.hydrated,
    s.currentUserId,
    s.profiles,
    s.lang,
    s.listings,
    s.requests,
    s.threads,
    s.threadListing,
    s.threadStarter,
    s.threadAccepted,
    s.threadRead,
    s.notifications,
    s.reviews,
    s.handoffs,
    s.reportCounts,
    s.saved,
    s.blocked,
    s.notify,
    s.dp,
    s.names,
    s.radius,
    s.activeMode,
    s.activeCityId,
    s.userCity,
    s.onboarded,
    // these are all in the persist snapshot but were missing here — a change to ONLY one
    // of them (e.g. dismiss nudge / hide safety banner / dismiss a request) must still save.
    s.currentUserEmail,
    s.dismissedRequests,
    s.threadCleared,
    s.notifyNudgeDate,
    s.safetyHidden,
  ]);

  return <PassContext value={store}>{children}</PassContext>;
}

export function usePass(): Store {
  const ctx = use(PassContext);
  if (!ctx) throw new Error('usePass must be used within PassProvider');
  return ctx;
}

/** Returns a `t(key, params?)` translator bound to the user's chosen language. */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const { s } = usePass();
  return (key: string, params?: Record<string, string | number>) => translate(s.lang, key, params);
}

export { CATS, CITIES };
