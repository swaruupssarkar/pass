// Design tokens for the `pass` app, ported from Pass.dc.html.
// The prototype supports several accent themes; Coral Red is the default and
// the one this app ships with. The full map is kept so the accent can be
// swapped in one place.

export type Accent = {
  /** accent / primary */
  h: string;
  /** soft accent tint (chips, hero blocks) */
  s: string;
  /** app background */
  bg: string;
  /** hairline / border */
  line: string;
};

export const ACCENTS: Record<string, Accent> = {
  'Coral Red': { h: '#D94A2F', s: '#FBEAE3', bg: '#F2ECE7', line: '#E9E1D5' },
  Terracotta: { h: '#B85C38', s: '#F6E7DD', bg: '#F1EAE2', line: '#E7DDD0' },
  Mustard: { h: '#C08A1E', s: '#F8EFD8', bg: '#F2EEE2', line: '#E8E0CC' },
  'Forest Green': { h: '#2E7D52', s: '#E3F0E8', bg: '#EAEFE9', line: '#DAE5DC' },
  Teal: { h: '#1C8A82', s: '#DDF0EE', bg: '#E7EFEE', line: '#D6E4E2' },
  'Indigo Blue': { h: '#2F5BD0', s: '#E4EBFB', bg: '#EBEDF3', line: '#DCE0EC' },
  Plum: { h: '#7A4DB0', s: '#EFE6F6', bg: '#EEEAF1', line: '#E1DAEA' },
};

const accent = ACCENTS['Coral Red'];

export const C = {
  accent: accent.h,
  accentSoft: accent.s,
  bg: accent.bg,
  surface: '#FFFFFF',
  ink: '#111111',
  muted: '#7A736B',
  line: accent.line,
  free: '#2E9E5B',
  // assorted fixed tones used by individual screens
  star: '#F5A623',
  toggleOff: '#D8CFC2',
  warnBg: '#FFF7E8',
  warnBorder: '#F2E2BE',
  warnInk: '#7A5B12',
  dangerBg: '#FFF1F0',
  dangerBorder: '#F3CFC9',
  dangerInk: '#9A3329',
  pendingBg: '#FFF1D6',
  pendingInk: '#B8860B',
  mapLand: '#DDE6DE',
  mapRoad: '#EFEFE9',
  mapBlock: '#CFE0CF',
  blue: '#3B82F6',
} as const;

// Soft tints reused for placeholder photos / category tiles.
export const TINTS = [
  '#E6DCEA',
  '#E4EFE8',
  '#EDE3D2',
  '#E9DAD2',
  '#DCE6E2',
  '#EFE7DC',
  '#E7E0EE',
  '#E3EEE6',
  '#EEE6DC',
] as const;

// Diagonal hatch overlay used on every placeholder image in the design.
// Uses the New Architecture CSS background-image support; degrades to the
// flat tint underneath on platforms that ignore it.
export const hatch = (gap = 16) =>
  `repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0 ${gap / 2}px, transparent ${gap / 2}px ${gap}px)`;

export const radius = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
