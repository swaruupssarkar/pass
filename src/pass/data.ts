// Data model for the `pass` app.
// Two independent test users; every listing is owned by a user and tied to a
// city + real coordinates so location/radius filtering is accurate.

export type Coords = { lat: number; lng: number };

export type UserId = 'u1' | 'u2';

export type User = {
  id: UserId;
  name: string;
  initial: string;
  cityId: string;
  rating: number;
  since: string;
};

export type City = { id: string; name: string; initial: string; lat: number; lng: number };

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
  taken: boolean;
  takenBy?: UserId;
};

/** A "I want this" request from one user about another user's listing. */
export type RequestStatus = 'pending' | 'accepted' | 'declined';

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

export type Notification = {
  id: string;
  userId: UserId; // recipient
  title: string;
  body: string;
  ts: number;
  read: boolean;
  kind: 'message' | 'request' | 'taken';
  threadId?: string;
  listingId?: string;
  route?: string;
};

// ---- cities ----

export const CITIES: City[] = [
  { id: 'kol', name: 'Kolkata', initial: 'K', lat: 22.5726, lng: 88.3639 },
  { id: 'ban', name: 'Bangalore', initial: 'B', lat: 12.9716, lng: 77.5946 },
  { id: 'mum', name: 'Mumbai', initial: 'M', lat: 19.076, lng: 72.8777 },
  { id: 'pun', name: 'Pune', initial: 'P', lat: 18.5204, lng: 73.8567 },
  { id: 'che', name: 'Chennai', initial: 'C', lat: 13.0827, lng: 80.2707 },
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

export const CAT_SUBS: Record<string, string[]> = {
  Furniture: ['Sofas', 'Chairs', 'Tables', 'Beds', 'Shelves', 'Wardrobes'],
  Appliances: ['Fridges', 'Washers', 'Microwaves', 'Fans', 'ACs', 'Heaters'],
  Electronics: ['Laptops', 'Monitors', 'Speakers', 'TVs', 'Keyboards', 'Cables'],
  'Baby & Kids': ['Cribs', 'Strollers', 'Toys', 'Clothes', 'Car seats', 'High chairs'],
  Books: ['Fiction', 'Textbooks', 'Kids’', 'Comics', 'Cookbooks', 'Magazines'],
  Kitchen: ['Cookware', 'Crockery', 'Mixers', 'Storage', 'Cutlery', 'Bottles'],
  Clothes: ['Men', 'Women', 'Kids', 'Ethnic', 'Winter', 'Footwear'],
  'Home & Decor': ['Lamps', 'Rugs', 'Plants', 'Frames', 'Curtains', 'Mirrors'],
  Other: ['Tools', 'Sports', 'Bicycles', 'Garden', 'Stationery', 'Misc'],
};

// ---- the two test users ----

export const USERS: Record<UserId, User> = {
  u1: { id: 'u1', name: 'Riya Sen', initial: 'R', cityId: 'kol', rating: 4.9, since: '2023' },
  u2: { id: 'u2', name: 'Arjun Rao', initial: 'A', cityId: 'ban', rating: 4.8, since: '2022' },
};

export const OTHER_USER: Record<UserId, UserId> = { u1: 'u2', u2: 'u1' };

// ---- seeded listings (each owned by a test user, spread across two cities) ----

const T = ['#E5D9C9', '#D9E0DC', '#E6DCEA', '#E3DBC8', '#DEDCD2', '#E7DAC6', '#DCE6E2', '#EFE7DC'];
const BASE = 1_750_000_000_000;

export const SEED_LISTINGS: Listing[] = [
  // Riya (u1) — Kolkata
  { id: 'l1', ownerId: 'u1', title: '3-seater fabric sofa', blurb: 'Gently used · grey fabric', cat: 'Furniture', cond: 'Good', desc: 'Comfortable grey 3-seater, minor wear on one arm. Pickup from ground floor.', cityId: 'kol', lat: 22.5802, lng: 88.4094, address: 'Salt Lake, Sector 2, Kolkata', area: 'Salt Lake', tint: T[0], ph: 'sofa', createdAt: BASE - 1 * 3_600_000, taken: false },
  { id: 'l2', ownerId: 'u1', title: 'Box of novels (~30)', blurb: 'Mixed fiction · whole box', cat: 'Books', cond: 'Good', desc: 'Mostly paperback, a few hardcovers. Take the whole box.', cityId: 'kol', lat: 22.5641, lng: 88.3548, address: 'Jadavpur, Kolkata', area: 'Jadavpur', tint: T[3], ph: 'books', createdAt: BASE - 5 * 3_600_000, taken: false },
  // Riya (u1) — Bangalore (a trip listing)
  { id: 'l3', ownerId: 'u1', title: 'Floor lamp', blurb: 'Works · warm light', cat: 'Home & Decor', cond: 'Like new', desc: 'Tall floor lamp, warm LED, barely used.', cityId: 'ban', lat: 12.9784, lng: 77.6012, address: 'Indiranagar, Bengaluru', area: 'Indiranagar', tint: T[6], ph: 'lamp', createdAt: BASE - 9 * 3_600_000, taken: false },

  // Arjun (u2) — Bangalore
  { id: 'l4', ownerId: 'u2', title: 'Double-door fridge, 240L', blurb: 'Works well · slight dent', cat: 'Appliances', cond: 'Working', desc: 'Cools well, small dent on side door. You arrange transport.', cityId: 'ban', lat: 12.9698, lng: 77.5921, address: 'Koramangala, Bengaluru', area: 'Koramangala', tint: T[1], ph: 'fridge', createdAt: BASE - 2 * 3_600_000, taken: false },
  { id: 'l5', ownerId: 'u2', title: '4 wooden dining chairs', blurb: 'Solid teak · set of 4', cat: 'Furniture', cond: 'Fair', desc: 'Solid teak, sturdy, could use a polish. Set of four.', cityId: 'ban', lat: 12.9611, lng: 77.6101, address: 'HSR Layout, Bengaluru', area: 'HSR Layout', tint: T[5], ph: 'chairs', createdAt: BASE - 6 * 3_600_000, taken: false },
  // Arjun (u2) — Kolkata
  { id: 'l6', ownerId: 'u2', title: 'Baby crib + mattress', blurb: 'Like new · mattress incl.', cat: 'Baby & Kids', cond: 'Like new', desc: 'Wooden crib, barely used, mattress included. Folds flat.', cityId: 'kol', lat: 22.5512, lng: 88.3602, address: 'Lake Gardens, Kolkata', area: 'Lake Gardens', tint: T[2], ph: 'crib', createdAt: BASE - 3 * 3_600_000, taken: false },
  { id: 'l7', ownerId: 'u2', title: 'Solo microwave, 20L', blurb: 'Works · turntable incl.', cat: 'Kitchen', cond: 'Working', desc: 'Works well, comes with turntable plate. Clean inside.', cityId: 'kol', lat: 22.5739, lng: 88.3712, address: 'Ballygunge, Kolkata', area: 'Ballygunge', tint: T[4], ph: 'microwave', createdAt: BASE - 4 * 3_600_000, taken: false },

  // Riya (u1) — more in Kolkata
  { id: 'l8', ownerId: 'u1', title: 'Study table with drawer', blurb: 'Sturdy · one drawer', cat: 'Furniture', cond: 'Good', desc: 'Solid study table with a drawer. Minor scratches on top.', cityId: 'kol', lat: 22.519, lng: 88.365, address: 'Gariahat, Kolkata', area: 'Gariahat', tint: T[5], ph: 'study table', createdAt: BASE - 10 * 3_600_000, taken: false },
  { id: 'l9', ownerId: 'u1', title: 'Office chair', blurb: 'Adjustable · wheels', cat: 'Furniture', cond: 'Good', desc: 'Height-adjustable office chair, all wheels working.', cityId: 'kol', lat: 22.553, lng: 88.352, address: 'Park Street, Kolkata', area: 'Park Street', tint: T[6], ph: 'office chair', createdAt: BASE - 11 * 3_600_000, taken: false },
  { id: 'l10', ownerId: 'u1', title: 'Table lamp', blurb: 'Warm light · works', cat: 'Home & Decor', cond: 'Like new', desc: 'Bedside table lamp with warm LED bulb included.', cityId: 'kol', lat: 22.567, lng: 88.372, address: 'Sealdah, Kolkata', area: 'Sealdah', tint: T[7], ph: 'table lamp', createdAt: BASE - 12 * 3_600_000, taken: false },
  { id: 'l11', ownerId: 'u1', title: "Kids' tricycle", blurb: 'Ages 2–5 · sturdy', cat: 'Baby & Kids', cond: 'Good', desc: 'Tricycle for toddlers, sturdy frame, slight rust on handle.', cityId: 'kol', lat: 22.601, lng: 88.374, address: 'Shyambazar, Kolkata', area: 'Shyambazar', tint: T[0], ph: 'tricycle', createdAt: BASE - 13 * 3_600_000, taken: false },
  { id: 'l12', ownerId: 'u1', title: 'Steel cookware set', blurb: '5 pieces · clean', cat: 'Kitchen', cond: 'Working', desc: 'Stainless steel cookware set, 5 pieces, well maintained.', cityId: 'kol', lat: 22.535, lng: 88.33, address: 'Alipore, Kolkata', area: 'Alipore', tint: T[1], ph: 'cookware', createdAt: BASE - 14 * 3_600_000, taken: false },

  // Arjun (u2) — more in Kolkata
  { id: 'l13', ownerId: 'u2', title: 'LED monitor, 24"', blurb: 'Full HD · works', cat: 'Electronics', cond: 'Working', desc: '24-inch Full HD monitor, HDMI + VGA. Cable included.', cityId: 'kol', lat: 22.565, lng: 88.351, address: 'Esplanade, Kolkata', area: 'Esplanade', tint: T[2], ph: 'monitor', createdAt: BASE - 15 * 3_600_000, taken: false },
  { id: 'l14', ownerId: 'u2', title: 'Winter jackets (3)', blurb: 'Mens M · warm', cat: 'Clothes', cond: 'Good', desc: 'Three warm winter jackets, size M. Lightly used.', cityId: 'kol', lat: 22.499, lng: 88.346, address: 'Tollygunge, Kolkata', area: 'Tollygunge', tint: T[3], ph: 'jackets', createdAt: BASE - 16 * 3_600_000, taken: false },
  { id: 'l15', ownerId: 'u2', title: 'Bookshelf', blurb: '4 shelves · wood', cat: 'Furniture', cond: 'Fair', desc: 'Four-shelf wooden bookshelf. Needs a wipe, otherwise solid.', cityId: 'kol', lat: 22.627, lng: 88.42, address: 'Dum Dum, Kolkata', area: 'Dum Dum', tint: T[4], ph: 'bookshelf', createdAt: BASE - 17 * 3_600_000, taken: false },
  { id: 'l16', ownerId: 'u2', title: 'Wall mirror', blurb: 'Framed · large', cat: 'Home & Decor', cond: 'Like new', desc: 'Large framed wall mirror, no cracks. Pickup with care.', cityId: 'kol', lat: 22.576, lng: 88.318, address: 'Howrah, Kolkata', area: 'Howrah', tint: T[5], ph: 'mirror', createdAt: BASE - 18 * 3_600_000, taken: false },
  { id: 'l17', ownerId: 'u2', title: 'Textbooks bundle', blurb: 'Class 11–12 · science', cat: 'Books', cond: 'Good', desc: 'Science textbooks for class 11–12. Take the whole bundle.', cityId: 'kol', lat: 22.463, lng: 88.392, address: 'Garia, Kolkata', area: 'Garia', tint: T[6], ph: 'textbooks', createdAt: BASE - 19 * 3_600_000, taken: false },
];

// ---- onboarding + misc copy ----

export const INTRO_CARDS = [
  { tint: '#E4EFE8', img: 'find free stuff', title: 'Find free stuff near you', body: 'Browse furniture, appliances, books and more — given away by neighbours, completely free.', cta: 'Next' },
  { tint: '#FBEAE3', img: 'give a box', title: 'Give away what you don’t need', body: 'Post it in a minute. Someone close by will love it — and it stays out of a landfill.', cta: 'Get started' },
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
