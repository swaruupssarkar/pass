// Address lookup: Google Places autocomplete when a key is configured, with a
// device-geocoder fallback. Both paths yield { lat, lng, address }.

import * as Location from 'expo-location';

import { GOOGLE_PLACES_KEY, hasPlaces } from '@/pass/config';

export type Suggestion = { id: string; label: string };
export type Place = { lat: number; lng: number; address: string };

/** As-you-type suggestions (Google Places). Empty when no key is set. */
export async function autocomplete(input: string): Promise<Suggestion[]> {
  const q = input.trim();
  if (q.length < 3 || !hasPlaces()) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_PLACES_KEY}`;
    const res = await fetch(url);
    const json = (await res.json()) as { predictions?: { place_id: string; description: string }[] };
    return (json.predictions ?? []).map((p) => ({ id: p.place_id, label: p.description }));
  } catch {
    return [];
  }
}

/** Resolve a Places suggestion to coordinates + a readable address. */
export async function placeDetails(id: string): Promise<Place | null> {
  if (!hasPlaces()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${id}&fields=geometry,formatted_address&key=${GOOGLE_PLACES_KEY}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      result?: { geometry?: { location?: { lat: number; lng: number } }; formatted_address?: string };
    };
    const r = json.result;
    if (!r?.geometry?.location) return null;
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address ?? '' };
  } catch {
    return null;
  }
}

/** Fallback: turn a typed address into coordinates via the device geocoder. */
export async function geocodeAddress(address: string): Promise<Place | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const r = await Location.geocodeAsync(q);
    if (!r.length) return null;
    return { lat: r[0].latitude, lng: r[0].longitude, address: q };
  } catch {
    return null;
  }
}

/** Turn coordinates (e.g. a dropped pin) into a readable address. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!r.length) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const a = r[0];
    return [a.name, a.street, a.district, a.city, a.region].filter(Boolean).join(', ');
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
