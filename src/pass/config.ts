// Set your Google Maps/Places API key (Places + Geocoding APIs enabled, billing on)
// via an env var: EXPO_PUBLIC_GOOGLE_PLACES_KEY=...  (e.g. in a .env file)
// or app.json -> expo.extra.googlePlacesKey. Until set, the address field falls
// back to the device geocoder (no live suggestion dropdown).

import Constants from 'expo-constants';

export const GOOGLE_PLACES_KEY: string =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ??
  (Constants.expoConfig?.extra?.googlePlacesKey as string | undefined) ??
  '';

export const hasPlaces = (): boolean => GOOGLE_PLACES_KEY.length > 0;

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

export const REPORT_ENDPOINT: string =
  process.env.EXPO_PUBLIC_REPORT_ENDPOINT ??
  (Constants.expoConfig?.extra?.reportEndpoint as string | undefined) ??
  '';
