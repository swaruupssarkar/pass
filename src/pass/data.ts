// Data model for the `pass` app.
// Two independent test users; every listing is owned by a user and tied to a
// city + real coordinates so location/radius filtering is accurate.

export type Coords = { lat: number; lng: number };

// Real auth makes this a Supabase user uuid. '' means logged-out. The seed
// demo ids 'u1'/'u2' are still valid strings (they own the seed listings).
export type UserId = string;

// A user record as cached in the store (current user + everyone referenced by
// listings/threads/etc). Hydrated from Supabase `profiles`.
export type Profile = {
  id: string;
  name: string;
  cityId?: string | null;
  since?: string;
  dp?: string | null;
};

export type City = { id: string; name: string; initial: string; lat: number; lng: number; landmark: string; img: string };

export type Listing = {
  id: string;
  ownerId: UserId;
  title: string;
  blurb: string;
  cat: string;
  cond: string;
  desc: string;
  cityId: string;
  lat: number;
  lng: number;
  address: string;
  area: string;
  tint: string;
  ph: string;
  photos?: string[];
  createdAt: number;
  /** Set when the listing is edited after posting. */
  updatedAt?: number;
  taken: boolean;
  takenBy?: UserId;
  /** Server-set: hidden from browse once reports cross the threshold. */
  delisted?: boolean;
};

/** A "I want this" request from one user about another user's listing. */
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type Request = {
  id: string;
  listingId: string;
  fromUserId: UserId;
  toUserId: UserId;
  note: string;
  createdAt: number;
  status: RequestStatus;
};

export type Message = { id: string; from: UserId; text: string; ts: number; image?: string };

export type Review = {
  id: string;
  from: UserId;
  to: UserId;
  listingId?: string;
  rating: number;
  tags: string[];
  text: string;
  ts: number;
};

// a persistent record of a hand-off — snapshots title/photo so it survives the listing being deleted
export type Handoff = {
  id: string;
  listingId: string;
  giverId: UserId;
  recipientId: UserId;
  title: string;
  photo?: string;
  tint: string;
  cat: string;
  ts: number;
};

export type Notification = {
  id: string;
  userId: UserId; // recipient
  title: string;
  body: string;
  ts: number;
  read: boolean;
  kind: 'message' | 'request' | 'taken' | 'item';
  threadId?: string;
  listingId?: string;
  route?: string;
};

// ---- cities ----

export const CITIES: City[] = [
  { id: 'kol', name: 'Kolkata', initial: 'K', lat: 22.5726, lng: 88.3639, landmark: 'Victoria Memorial', img: 'https://loremflickr.com/600/400/victoria,memorial,kolkata?lock=21' },
  { id: 'ban', name: 'Bangalore', initial: 'B', lat: 12.9716, lng: 77.5946, landmark: 'Vidhana Soudha', img: 'https://loremflickr.com/600/400/vidhana,soudha,bengaluru?lock=22' },
  { id: 'mum', name: 'Mumbai', initial: 'M', lat: 19.076, lng: 72.8777, landmark: 'Gateway of India', img: 'https://loremflickr.com/600/400/gateway,of,india,mumbai?lock=23' },
  { id: 'pun', name: 'Pune', initial: 'P', lat: 18.5204, lng: 73.8567, landmark: 'Shaniwar Wada', img: 'https://loremflickr.com/600/400/shaniwar,wada,pune?lock=24' },
  { id: 'che', name: 'Chennai', initial: 'C', lat: 13.0827, lng: 80.2707, landmark: 'Marina Beach', img: 'https://loremflickr.com/600/400/marina,beach,chennai?lock=25' },
];

export const cityById = (id: string): City => CITIES.find((c) => c.id === id) ?? CITIES[0];

export const CATS = [
  'Furniture',
  'Appliances',
  'Electronics',
  'Baby & Kids',
  'Books',
  'Kitchen',
  'Clothes',
  'Home & Decor',
  'Other',
];

// ---- onboarding + misc copy ----

export const INTRO_CARDS = [
  { tint: '#E4EFE8', icon: 'search', img: 'find free stuff', title: 'Find free stuff near you', body: 'Browse furniture, appliances, books and more — given away by neighbours, completely free.', cta: 'Next' },
  { tint: '#FBEAE3', icon: 'gift', img: 'give a box', title: 'Give away what you don’t need', body: 'Post it in a minute. Someone close by will love it — and it stays out of a landfill.', cta: 'Get started' },
];

export const REPORT_REASONS = [
  'They asked me for money',
  'Item already gone',
  'Listing looks fake',
  'Inappropriate behaviour',
  'Something else',
];

export const RATE_TAGS = ['On time', 'Friendly', 'Item as described'];

// ---- geo helpers ----

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
