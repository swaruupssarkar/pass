// Set your Google Maps/Places API key (Places + Geocoding APIs enabled, billing on)
// via an env var: EXPO_PUBLIC_GOOGLE_PLACES_KEY=...  (e.g. in a .env file)
// or app.json -> expo.extra.googlePlacesKey. Until set, the address field falls
// back to the device geocoder (no live suggestion dropdown).

import Constants from 'expo-constants';

// Running inside Expo Go (not a dev/standalone build). expo-notifications' remote
// push was removed from Expo Go in SDK 53 and THROWS on import, so push code must
// be skipped here. Push/maps/OAuth only work in the dev or production build.
export const isExpoGo = Constants.appOwnership === 'expo';

export const GOOGLE_PLACES_KEY: string =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ??
  (Constants.expoConfig?.extra?.googlePlacesKey as string | undefined) ??
  '';

export const hasPlaces = (): boolean => GOOGLE_PLACES_KEY.length > 0;

// ---- Supabase backend ----
// Publishable/anon key — safe to ship in the client; Row-Level Security enforces
// access. Set via .env (EXPO_PUBLIC_SUPABASE_*) or app.json -> expo.extra.
export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  '';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  '';

// When unset, the app keeps running in local-only mode (mirrors hasPlaces()).
export const hasSupabase = (): boolean => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// ---- PostHog product analytics ----
// Project API key is publishable (write-only ingestion) — safe in the client.
// Host: US cloud = https://us.i.posthog.com, EU = https://eu.i.posthog.com.
export const POSTHOG_KEY: string =
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  (Constants.expoConfig?.extra?.posthogKey as string | undefined) ??
  '';

export const POSTHOG_HOST: string =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  (Constants.expoConfig?.extra?.posthogHost as string | undefined) ??
  'https://us.i.posthog.com';

export const hasPostHog = (): boolean => POSTHOG_KEY.length > 0;

// Moderation: a listing is automatically delisted (hidden from browse) once it
// receives this many reports. Change this single value to tune the threshold.
export const REPORT_DELIST_THRESHOLD = 5;

// ---- listing reports → email ----
// Reports are emailed to this address. A phone-only Expo app can't send mail by
// itself, so delivery goes through a Formspree form (https://formspree.io):
//   1. Sign up at formspree.io with REPORT_EMAIL below as the form's recipient.
//   2. Create a form; copy its endpoint (looks like https://formspree.io/f/abcwxyz).
//   3. Put it in a .env file as  EXPO_PUBLIC_REPORT_ENDPOINT=https://formspree.io/f/abcwxyz
//      (or app.json -> expo.extra.reportEndpoint). Until set, no email is sent.
export const REPORT_EMAIL = 'sarkarrup136@gmail.com';

// In-app feedback (bug / feature / thanks) is emailed here, sent FROM the user's
// own mail app via expo-mail-composer.
export const SUPPORT_EMAIL = 'support@daata.in';

export const REPORT_ENDPOINT: string =
  process.env.EXPO_PUBLIC_REPORT_ENDPOINT ??
  (Constants.expoConfig?.extra?.reportEndpoint as string | undefined) ??
  '';
