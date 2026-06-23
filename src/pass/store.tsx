import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  CATS,
  CITIES,
  cityById,
  type Coords,
  fmtKm,
  type Handoff,
  haversineKm,
  type Listing,
  type Message,
  type Notification,
  type Review,
  OTHER_USER,
  type Profile,
  type Request,
  REPORT_REASONS,
  SEED_LISTINGS,
  SEED_PROFILES,
  type UserId,
  USERS,
} from '@/pass/data';
import { REPORT_DELIST_THRESHOLD, REPORT_EMAIL, REPORT_ENDPOINT } from '@/pass/config';
import { supabase } from '@/pass/supabase';
import { DEFAULT_LANG, type LangCode, translate } from '@/pass/i18n';
import { reverseGeocode } from '@/pass/places';
import { TINTS } from '@/pass/theme';

export type SortMode = 'Nearest' | 'Newest';
export type LocStatus = 'undetermined' | 'granted' | 'denied';
export type LocMode = 'city' | 'gps';

export type DialogAction = { label: string; kind?: 'primary' | 'cancel' | 'destructive'; onPress?: () => void };
export type Dialog = { title: string; message?: string; actions: DialogAction[] };

export type NotifyPrefs = { near: boolean; chat: boolean; addr: { lat: number; lng: number; label: string } | null };
const NOTIFY_RADIUS_KM = 100;

/** The report payload that gets emailed (see deliverReport). Nothing is stored. */
export type ReportPayload = {
  listingId: string;
  listingTitle: string;
  reason: string;
  reportedBy: string;
  ts: number;
};

const STORAGE_KEY = 'pass.state.v4';

type State = {
  /** Supabase auth user id ('' when logged out). */
  currentUserId: UserId;
  /** cache of user records (current user + everyone referenced); seeded from SEED_PROFILES. */
  profiles: Record<string, Profile>;
  /** false until the initial Supabase session check resolves (gates the splash). */
  authReady: boolean;
  lang: LangCode;
  listings: Listing[];
  requests: Request[];
  threads: Record<string, Message[]>;
  threadListing: Record<string, string>;
  /** who opened the conversation first (the other party must accept a cold DM) */
  threadStarter: Record<string, UserId>;
  /** conversations the recipient has accepted (or that came from an accepted request) */
  threadAccepted: Record<string, boolean>;
  /** last time each user viewed a thread — powers read receipts (single/double tick) */
  threadRead: Record<string, Record<UserId, number>>;
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
  galleryIdx: number;
  sheetExpanded: boolean;
  showRadius: boolean;
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
  dialog: Dialog | null;
};

const INITIAL: State = {
  currentUserId: '',
  profiles: { ...SEED_PROFILES },
  authReady: false,
  lang: DEFAULT_LANG,
  listings: SEED_LISTINGS.map((l) => ({ ...l })),
  requests: [],
  threads: {},
  threadListing: {},
  threadStarter: {},
  threadAccepted: {},
  threadRead: {},
  notifications: [],
  reviews: [],
  handoffs: [],
  activeMode: 'city',
  activeCityId: USERS.u1.cityId,
  userCity: { u1: USERS.u1.cityId, u2: USERS.u2.cityId },
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
  galleryIdx: 0,
  sheetExpanded: false,
  showRadius: false,
  postTitle: '',
  postCat: 'Furniture',
  postCond: 'Good',
  postAvail: 'Evenings after 6pm, this week',
  postPhotos: [],
  postAddress: '',
  postCoords: null,
  postCityId: USERS.u1.cityId,
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
  notify: { u1: { near: true, chat: true, addr: null }, u2: { near: true, chat: true, addr: null } },
  dp: { u1: null, u2: null },
  names: {},
  onboarded: false,
  hydrated: false,
  dialog: null,
};

// ---- pure helpers ----

// current user's profile, with a safe fallback so call sites never crash pre-load
export const me = (s: State): Profile =>
  s.profiles[s.currentUserId] ?? { id: s.currentUserId, name: 'You', dp: null };
// seed-only helper (two demo users); real auth has no fixed "other" user
export const otherOf = (id: UserId): Profile =>
  s_profile(SEED_PROFILES, OTHER_USER[id]) ?? { id: OTHER_USER[id] ?? '', name: 'Someone', dp: null };
const s_profile = (m: Record<string, Profile>, id?: string) => (id ? m[id] : undefined);
// resolve any user id to a Profile (cache → seed → safe fallback)
export const profileOf = (s: State, id: UserId): Profile =>
  s.profiles[id] ?? SEED_PROFILES[id] ?? { id, name: 'Someone', dp: null };

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
export const hasUserPoint = (s: State): boolean => userPoint(s) !== null;

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
  if (s.activeMode === 'city') list = list.filter((l) => l.cityId === s.activeCityId);
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
/** Everyone the current user has blocked. */
export const blockedUserIds = (s: State): UserId[] =>
  (Object.keys(USERS) as UserId[]).filter((id) => id !== s.currentUserId && iBlocked(s, id));

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
    .filter((r) => r.fromUserId === s.currentUserId)
    .map((r) => ({ request: r, listing: listingById(s, r.listingId) }));

/** Requests other people made for the current user's listings. */
export const incomingRequests = (
  s: State
): { request: Request; user: Profile; listing: Listing | null }[] =>
  s.requests
    .filter((r) => r.toUserId === s.currentUserId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({ request: r, user: profileOf(s, r.fromUserId), listing: listingById(s, r.listingId) }));

export const incomingPendingCount = (s: State): number =>
  s.requests.filter((r) => r.toUserId === s.currentUserId && r.status === 'pending').length;

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
export const threadUsers = (id: string): UserId[] => id.replace(/^p:/, '').split('-') as UserId[];

export function otherInThread(s: State, id: string): UserId {
  const [a, b] = threadUsers(id);
  return s.currentUserId === a ? b : a;
}

/**
 * True when the other person started this conversation (a cold DM) and the
 * current user has not accepted it yet. The recipient sees accept / delete /
 * block instead of a reply box until they accept.
 */
export const threadPendingForMe = (s: State, id: string): boolean => {
  const starter = s.threadStarter?.[id];
  return !!starter && starter !== s.currentUserId && !s.threadAccepted?.[id];
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
  s.names?.[id] ?? s.profiles[id]?.name ?? USERS[id]?.name ?? 'Someone';

/** Real average rating computed from received reviews; null when none yet. */
export function userRating(s: State, id: UserId): number | null {
  const rs = reviewsFor(s, id);
  if (rs.length === 0) return null;
  return Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10;
}

/** How many reports a listing has received (this device). */
export const reportCount = (s: State, listingId: string): number =>
  s.reportCounts?.[listingId] ?? 0;

/** A listing is auto-delisted once it crosses the report threshold. */
export const isDelisted = (s: State, listingId: string): boolean =>
  reportCount(s, listingId) >= REPORT_DELIST_THRESHOLD;

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
  signInWithEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // location
  setCity: (cityId: string) => void;
  useCurrentLocation: () => Promise<'granted' | 'denied' | 'error'>;
  requestLocation: () => Promise<void>;
  requestNotifications: () => Promise<'granted' | 'denied' | 'error'>;
  // browse
  openListing: (id: string) => void;
  toggleSave: (id: string) => void;
  viewPerson: (id: UserId) => void;
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
  deleteThread: (id: string) => void;
  acceptThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  openThread: (id: string) => void;
  sendMsg: (text: string) => void;
  sendImage: (uri: string) => void;
  shareLoc: () => Promise<void>;
  blockUser: (id: UserId) => void;
  unblockUser: (id: UserId) => void;
  // mark taken + rate
  openTakenPicker: (listingId: string) => void;
  confirmTaken: (listingId: string, recipientId: UserId) => void;
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
  // profile editing
  setName: (name: string) => void;
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

      signInWithEmail: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        });
        return error ? { ok: false, error: error.message } : { ok: true };
      },

      verifyOtp: async (email, token) => {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          type: 'email',
        });
        // on success the onAuthStateChange listener populates currentUserId + profile
        return error ? { ok: false, error: error.message } : { ok: true };
      },

      logout: async () => {
        await supabase.auth.signOut();
        setS((prev) => ({
          ...prev,
          currentUserId: '',
          activeThreadId: null,
          activeListingId: null,
          activePersonId: null,
          q: '',
          catFilter: null,
          draft: '',
        }));
      },

      setCity: (cityId) =>
        setS((prev) => ({
          ...prev,
          activeMode: 'city',
          activeCityId: cityId,
          userCity: { ...prev.userCity, [prev.currentUserId]: cityId },
        })),

      useCurrentLocation: async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setS((prev) => ({ ...prev, locStatus: 'denied' }));
          return 'denied';
        }
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setS((prev) => ({ ...prev, locStatus: 'granted', userLoc: coords, activeMode: 'gps', userLocLabel: 'Current location' }));
          const label = await reverseGeocode(coords.lat, coords.lng);
          setS((prev) => ({ ...prev, userLocLabel: label }));
          return 'granted';
        } catch {
          setS((prev) => ({ ...prev, locStatus: 'granted', activeMode: 'gps' }));
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

      openListing: (id) => setS((prev) => ({ ...prev, activeListingId: id, galleryIdx: 0, sheetExpanded: false })),
      toggleSave: (id) => setS((prev) => ({ ...prev, saved: { ...prev.saved, [id]: !prev.saved[id] } })),
      viewPerson: (id) => setS((prev) => ({ ...prev, activePersonId: id })),

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
            return { ...prev, listings, editingId: null };
          }
          const id = uid('l');
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
          const nearNotifs = (Object.keys(prev.notify) as UserId[])
            .filter((uid) => uid !== prev.currentUserId)
            .filter((uid) => {
              const p = prev.notify[uid];
              return p.near && p.addr && haversineKm(p.addr, { lat: listing.lat, lng: listing.lng }) <= NOTIFY_RADIUS_KM;
            })
            .map((uid) =>
              notify(prev, { userId: uid, kind: 'item', title: 'New free item near you', body: listing.title, listingId: listing.id, route: '/detail' })
            );
          return {
            ...prev,
            listings: [listing, ...prev.listings],
            activeListingId: id,
            notifications: [...nearNotifs, ...prev.notifications],
          };
        });
        return outId;
      },

      deleteListing: (id) =>
        setS((prev) => ({
          ...prev,
          listings: prev.listings.filter((l) => l.id !== id),
          requests: prev.requests.filter((r) => r.listingId !== id),
          threads: Object.fromEntries(Object.entries(prev.threads).filter(([tid]) => !tid.startsWith(`${id}:`))),
          takenPickerId: prev.takenPickerId === id ? null : prev.takenPickerId,
          activeListingId: prev.activeListingId === id ? null : prev.activeListingId,
        })),

      // send a request to the owner. If a chat with them already exists, the request
      // also drops into that thread as a message (so it shows under Chats, not Requests).
      requestListing: (listingId, note) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === listingId);
          if (!l) return prev;
          if (prev.requests.some((r) => r.listingId === listingId && r.fromUserId === prev.currentUserId)) return prev;
          const now = Date.now();
          const text = note.trim() || `Hi! Is the ${l.title} still available?`;
          const req: Request = {
            id: uid('r'),
            listingId,
            fromUserId: prev.currentUserId,
            toUserId: l.ownerId,
            note: text,
            createdAt: now,
            status: 'pending',
          };
          const tid = threadId(prev.currentUserId, l.ownerId);
          const hasThread = !!prev.threads[tid];
          const threads = hasThread
            ? { ...prev.threads, [tid]: [...prev.threads[tid], { id: uid('m'), from: prev.currentUserId, text, ts: now }] }
            : prev.threads;
          const threadListing = hasThread ? { ...prev.threadListing, [tid]: listingId } : prev.threadListing;
          // engaging with someone's listing counts as accepting any chat they opened
          const threadStarter = hasThread
            ? { ...prev.threadStarter, [tid]: prev.threadStarter[tid] ?? prev.currentUserId }
            : prev.threadStarter;
          const threadAccepted = hasThread ? { ...prev.threadAccepted, [tid]: true } : prev.threadAccepted;
          return {
            ...prev,
            requests: [req, ...prev.requests],
            threads,
            threadListing,
            threadStarter,
            threadAccepted,
            notifications: [
              notify(prev, {
                userId: l.ownerId,
                kind: hasThread ? 'message' : 'request',
                title: `${userName(prev, prev.currentUserId)} wants your ${l.title}`,
                body: text,
                threadId: hasThread ? tid : undefined,
                listingId,
                route: hasThread ? '/thread' : '/manage',
              }),
              ...prev.notifications,
            ],
          };
        }),

      // owner accepts -> opens a shared thread (seeded with the requester's note) for both
      acceptRequest: (requestId) =>
        setS((prev) => {
          const req = prev.requests.find((r) => r.id === requestId);
          if (!req) return prev;
          const id = threadId(req.toUserId, req.fromUserId);
          const l = prev.listings.find((x) => x.id === req.listingId);
          const seed: Message = { id: uid('m'), from: req.fromUserId, text: req.note, ts: req.createdAt };
          const accept: Message = {
            id: uid('m'),
            from: req.toUserId,
            text: `Accepted your request for ${l?.title ?? 'the item'}. Let's arrange the pickup!`,
            ts: Date.now(),
          };
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
        }),

      declineRequest: (requestId) =>
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
        }),

      // remove a request (pending or accepted). Removing an accepted one un-reserves
      // the listing, so it returns to the public feed. The other party gets a neutral
      // notice — the reason is kept private (it drives the follow-up block prompt).
      cancelRequest: (requestId, _reason) =>
        setS((prev) => {
          const req = prev.requests.find((r) => r.id === requestId);
          if (!req) return prev;
          const other = prev.currentUserId === req.fromUserId ? req.toUserId : req.fromUserId;
          const l = prev.listings.find((x) => x.id === req.listingId);
          const title = `${userName(prev, prev.currentUserId)} cancelled the request${l ? ` for ${l.title}` : ''}`;
          return {
            ...prev,
            requests: prev.requests.filter((r) => r.id !== requestId),
            cancelTarget: null,
            notifications: [
              notify(prev, { userId: other, kind: 'request', title, body: '', listingId: req.listingId }),
              ...prev.notifications,
            ],
          };
        }),

      openCancelReason: (requestId, role) => setS((prev) => ({ ...prev, cancelTarget: { requestId, role } })),
      closeCancelReason: () => setS((prev) => ({ ...prev, cancelTarget: null })),

      // silently drop a request from my list (no notification) — used once a deal is
      // settled (item given) or already declined, just to clear it off the screen
      removeRequest: (requestId) =>
        setS((prev) => ({ ...prev, requests: prev.requests.filter((r) => r.id !== requestId) })),

      openThreadFor: (listingId) => {
        const l = s.listings.find((x) => x.id === listingId);
        const otherId = l ? l.ownerId : OTHER_USER[s.currentUserId];
        // never start a chat with yourself (e.g. messaging from your own listing)
        if (otherId === s.currentUserId) return s.activeThreadId ?? '';
        const id = threadId(s.currentUserId, otherId);
        setS((prev) => {
          const { threads, threadListing } = ensurePairThread(prev, otherId, listingId);
          // remember who reached out first so the recipient can accept/decline the chat
          const threadStarter = prev.threadStarter[id]
            ? prev.threadStarter
            : { ...prev.threadStarter, [id]: prev.currentUserId };
          return { ...prev, threads, threadListing, threadStarter, activeThreadId: id };
        });
        return id;
      },

      openThread: (id) =>
        setS((prev) => ({
          ...prev,
          activeThreadId: id,
          notifications: prev.notifications.map((n) =>
            n.userId === prev.currentUserId && n.threadId === id ? { ...n, read: true } : n
          ),
        })),

      deleteThread: (id) =>
        setS((prev) => ({
          ...prev,
          threads: Object.fromEntries(Object.entries(prev.threads).filter(([k]) => k !== id)),
          threadListing: Object.fromEntries(Object.entries(prev.threadListing).filter(([k]) => k !== id)),
          threadStarter: Object.fromEntries(Object.entries(prev.threadStarter).filter(([k]) => k !== id)),
          threadAccepted: Object.fromEntries(Object.entries(prev.threadAccepted).filter(([k]) => k !== id)),
          threadRead: Object.fromEntries(Object.entries(prev.threadRead).filter(([k]) => k !== id)),
          activeThreadId: prev.activeThreadId === id ? null : prev.activeThreadId,
          notifications: prev.notifications.filter((n) => n.threadId !== id),
        })),

      acceptThread: (id) =>
        setS((prev) => ({ ...prev, threadAccepted: { ...prev.threadAccepted, [id]: true } })),

      // stamp that the current user has seen this thread up to now (for read receipts)
      markThreadRead: (id) =>
        setS((prev) => ({
          ...prev,
          threadRead: { ...prev.threadRead, [id]: { ...(prev.threadRead[id] ?? {}), [prev.currentUserId]: Date.now() } },
        })),

      // text is passed in from the composer's local state so typing never touches
      // global state (which would re-render every screen on each keystroke)
      sendMsg: (text) =>
        setS((prev) => {
          const id = prev.activeThreadId;
          const body = text.trim();
          if (!id || !body) return prev;
          const other = otherInThread(prev, id);
          const msg: Message = { id: uid('m'), from: prev.currentUserId, text: body, ts: Date.now() };
          const meta = threadMeta(prev, id);
          const starter = prev.threadStarter[id] ?? prev.currentUserId;
          const threadStarter = prev.threadStarter[id] ? prev.threadStarter : { ...prev.threadStarter, [id]: starter };
          // replying to a chat someone else opened accepts it
          const threadAccepted =
            starter !== prev.currentUserId ? { ...prev.threadAccepted, [id]: true } : prev.threadAccepted;
          return {
            ...prev,
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            threadStarter,
            threadAccepted,
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: text, threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        }),

      shareLoc: async () => {
        if (!s.activeThreadId) return;
        let text = 'Shared my live location for the meetup';
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            text = `My live location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
          }
        } catch {}
        setS((prev) => {
          const id = prev.activeThreadId;
          if (!id) return prev;
          const other = otherInThread(prev, id);
          const msg: Message = { id: uid('m'), from: prev.currentUserId, text, ts: Date.now() };
          const meta = threadMeta(prev, id);
          return {
            ...prev,
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: 'Shared a live location', threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        });
      },

      sendImage: (uri) =>
        setS((prev) => {
          const id = prev.activeThreadId;
          if (!id) return prev;
          const other = otherInThread(prev, id);
          const msg: Message = { id: uid('m'), from: prev.currentUserId, text: '', image: uri, ts: Date.now() };
          const meta = threadMeta(prev, id);
          return {
            ...prev,
            threads: { ...prev.threads, [id]: [...(prev.threads[id] ?? []), msg] },
            notifications: [
              notify(prev, { userId: other, kind: 'message', title: `New message from ${userName(prev, prev.currentUserId)}`, body: 'Sent a photo', threadId: id, listingId: meta.listingId ?? undefined, route: '/thread' }),
              ...prev.notifications,
            ],
          };
        }),

      blockUser: (id) => setS((prev) => ({ ...prev, blocked: { ...prev.blocked, [blockKey(prev.currentUserId, id)]: true } })),
      unblockUser: (id) => setS((prev) => ({ ...prev, blocked: { ...prev.blocked, [blockKey(prev.currentUserId, id)]: false } })),

      openTakenPicker: (listingId) => setS((prev) => ({ ...prev, takenPickerId: listingId })),

      confirmTaken: (listingId, recipientId) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === listingId);
          if (!l) return prev;
          const listings = prev.listings.map((x) => (x.id === listingId ? { ...x, taken: true, takenBy: recipientId } : x));
          // snapshot the hand-off so it persists even if the listing is later deleted
          const handoff: Handoff = { id: uid('h'), listingId, giverId: prev.currentUserId, recipientId, title: l.title, photo: l.photos?.[0], tint: l.tint, cat: l.cat, ts: Date.now() };
          return {
            ...prev,
            listings,
            handoffs: [handoff, ...(prev.handoffs ?? [])],
            takenPickerId: null,
            notifications: [
              notify(prev, {
                userId: recipientId,
                kind: 'taken',
                title: `${userName(prev, prev.currentUserId)} marked "${l.title}" as taken by you`,
                body: 'Please rate your experience.',
                listingId,
                route: '/rate',
              }),
              ...prev.notifications,
            ],
          };
        }),

      openRate: (n) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === n.listingId);
          return {
            ...prev,
            rateListingId: n.listingId ?? null,
            rateGiverId: l?.ownerId ?? null,
            rating: 0,
            rateTags: [],
            reviewDraft: '',
            notifications: prev.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
          };
        }),

      startRateForListing: (listingId, rating = 0) =>
        setS((prev) => {
          const l = prev.listings.find((x) => x.id === listingId);
          return { ...prev, rateListingId: listingId, rateGiverId: l?.ownerId ?? null, rating, rateTags: [], reviewDraft: '' };
        }),

      submitRate: () =>
        setS((prev) => {
          // one review per listing — never add a duplicate for the same item
          const dup = prev.rateListingId
            ? (prev.reviews ?? []).some((r) => r.from === prev.currentUserId && r.listingId === prev.rateListingId)
            : false;
          const reviews =
            prev.rateGiverId && !dup
              ? [
                  {
                    id: uid('rv'),
                    from: prev.currentUserId,
                    to: prev.rateGiverId,
                    listingId: prev.rateListingId ?? undefined,
                    rating: prev.rating,
                    tags: prev.rateTags,
                    text: prev.reviewDraft.trim(),
                    ts: Date.now(),
                  },
                  ...(prev.reviews ?? []),
                ]
              : (prev.reviews ?? []);
          return { ...prev, reviews, rateListingId: null, rateGiverId: null, rating: 0, rateTags: [], reviewDraft: '' };
        }),

      toggleRateTag: (t) =>
        setS((prev) => ({
          ...prev,
          rateTags: prev.rateTags.includes(t) ? prev.rateTags.filter((x) => x !== t) : [...prev.rateTags, t],
        })),

      markNotifsRead: () =>
        setS((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) => (n.userId === prev.currentUserId ? { ...n, read: true } : n)),
        })),

      deleteNotif: (id) =>
        setS((prev) => ({ ...prev, notifications: prev.notifications.filter((n) => n.id !== id) })),
      clearNotifs: () =>
        setS((prev) => ({ ...prev, notifications: prev.notifications.filter((n) => n.userId !== prev.currentUserId) })),

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
            return { ...prev, notifications: upd, rateListingId: n.listingId ?? null, rateGiverId: l?.ownerId ?? null, rating: 0, rateTags: [], reviewDraft: '' };
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
          const reportCounts = { ...prev.reportCounts, [listingId]: (prev.reportCounts[listingId] ?? 0) + 1 };
          return { ...prev, reportCounts, reportDone: true };
        }),
      markOnboarded: () => setS((prev) => (prev.onboarded ? prev : { ...prev, onboarded: true })),

      setName: (name) =>
        setS((prev) => ({ ...prev, names: { ...prev.names, [prev.currentUserId]: name.trim() || userName(prev, prev.currentUserId) } })),
      setDp: (uri) => setS((prev) => ({ ...prev, dp: { ...prev.dp, [prev.currentUserId]: uri } })),

      setNotifyNear: (on) =>
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: { ...prev.notify[prev.currentUserId], near: on } } })),
      setNotifyChat: (on) =>
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: { ...prev.notify[prev.currentUserId], chat: on } } })),
      setNotifyAddress: (coords, label) =>
        setS((prev) => ({ ...prev, notify: { ...prev.notify, [prev.currentUserId]: { ...prev.notify[prev.currentUserId], addr: { lat: coords.lat, lng: coords.lng, label } } } })),

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

  // hydrate
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
        // sync seed listings' photos with the current seed (clears any old stock URLs);
        // user-posted listings keep their own uploaded photos
        if (saved.listings) {
          const seedById = new Map(SEED_LISTINGS.map((l) => [l.id, l]));
          saved.listings = saved.listings.map((l) => (seedById.has(l.id) ? { ...l, photos: seedById.get(l.id)!.photos } : l));
          // backfill hand-off records for already-given listings that predate the log
          const logged = new Set((saved.handoffs ?? []).map((h) => h.listingId));
          const backfill: Handoff[] = saved.listings
            .filter((l) => l.taken && l.takenBy && !logged.has(l.id))
            .map((l) => ({ id: `h_${l.id}`, listingId: l.id, giverId: l.ownerId, recipientId: l.takenBy as UserId, title: l.title, photo: l.photos?.[0], tint: l.tint, cat: l.cat, ts: l.createdAt }));
          if (backfill.length) saved.handoffs = [...backfill, ...(saved.handoffs ?? [])];
        }
        // purge any self-chat threads (p:x-x) created by an earlier bug
        {
          const notSelf = ([k]: [string, unknown]) => {
            const [a, b] = k.replace(/^p:/, '').split('-');
            return a !== b;
          };
          if (saved.threads) saved.threads = Object.fromEntries(Object.entries(saved.threads).filter(notSelf)) as typeof saved.threads;
          if (saved.threadListing) saved.threadListing = Object.fromEntries(Object.entries(saved.threadListing).filter(notSelf)) as typeof saved.threadListing;
          if (saved.threadStarter) saved.threadStarter = Object.fromEntries(Object.entries(saved.threadStarter).filter(notSelf)) as typeof saved.threadStarter;
          if (saved.threadAccepted) saved.threadAccepted = Object.fromEntries(Object.entries(saved.threadAccepted).filter(notSelf)) as typeof saved.threadAccepted;
          if (saved.threadRead) saved.threadRead = Object.fromEntries(Object.entries(saved.threadRead).filter(notSelf)) as typeof saved.threadRead;
        }
        // backfill chat threads for accepted requests that predate thread-on-accept,
        // so an accepted request shows under Chats instead of lingering in Requests
        if (saved.requests?.length) {
          const threads = { ...(saved.threads ?? {}) };
          const threadListing = { ...(saved.threadListing ?? {}) };
          const threadStarter = { ...(saved.threadStarter ?? {}) };
          const threadAccepted = { ...(saved.threadAccepted ?? {}) };
          let changed = false;
          for (const r of saved.requests) {
            if (r.status !== 'accepted' || r.toUserId === r.fromUserId) continue;
            const id = threadId(r.toUserId, r.fromUserId);
            if (threads[id]?.length) continue;
            const l = (saved.listings ?? []).find((x) => x.id === r.listingId);
            threads[id] = [
              { id: uid('m'), from: r.fromUserId, text: r.note, ts: r.createdAt },
              { id: uid('m'), from: r.toUserId, text: `Accepted your request for ${l?.title ?? 'the item'}. Let's arrange the pickup!`, ts: r.createdAt + 1000 },
            ];
            threadListing[id] = r.listingId;
            threadStarter[id] = threadStarter[id] ?? r.fromUserId;
            threadAccepted[id] = true;
            changed = true;
          }
          if (changed) {
            saved.threads = threads;
            saved.threadListing = threadListing;
            saved.threadStarter = threadStarter;
            saved.threadAccepted = threadAccepted;
          }
        }
        if (alive) setS((prev) => ({ ...prev, ...saved, hydrated: true }));
      } catch {
        if (alive) setS((prev) => ({ ...prev, hydrated: true }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // auth: mirror the Supabase session into the store + bootstrap the profile row
  useEffect(() => {
    const applyUser = async (userId: string | null) => {
      if (!userId) {
        setS((prev) => ({ ...prev, currentUserId: '', authReady: true }));
        return;
      }
      setS((prev) => ({ ...prev, currentUserId: userId, authReady: true }));
      try {
        const email = (await supabase.auth.getUser()).data.user?.email ?? '';
        // safety net in case the signup trigger didn't run (keeps existing row)
        await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
        const { data } = await supabase
          .from('profiles')
          .select('id,name,city_id,dp,since')
          .eq('id', userId)
          .single();
        if (data) {
          setS((prev) => ({
            ...prev,
            profiles: {
              ...prev.profiles,
              [userId]: {
                id: data.id,
                name: data.name || email.split('@')[0] || 'You',
                cityId: data.city_id,
                dp: data.dp,
                since: data.since,
              },
            },
          }));
        }
      } catch {
        // offline / transient — the cache + fallback name keep the UI usable
      }
    };
    supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => applyUser(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // persist (debounced so the JSON.stringify never blocks the tap that triggered it)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!s.hydrated) return;
    const snapshot = {
      currentUserId: s.currentUserId,
      profiles: s.profiles,
      lang: s.lang,
      listings: s.listings,
      requests: s.requests,
      threads: s.threads,
      threadListing: s.threadListing,
      threadStarter: s.threadStarter,
      threadAccepted: s.threadAccepted,
      threadRead: s.threadRead,
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

export { CATS, CITIES, USERS };
