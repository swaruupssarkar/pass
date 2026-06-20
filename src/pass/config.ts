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
