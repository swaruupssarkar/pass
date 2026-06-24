// Address lookup. Uses Google Places when a key is configured; otherwise falls
// back to Photon (komoot) — a free, key-less OpenStreetMap geocoder built for
// as-you-type autocomplete. Both paths yield { lat, lng, address }.

import * as Location from 'expo-location';

import { GOOGLE_PLACES_KEY, hasPlaces } from '@/pass/config';

// Suggestions carry coordinates when the provider returns them inline (Photon),
// so we can move the pin without a second "details" round-trip.
export type Suggestion = { id: string; label: string; lat?: number; lng?: number };
export type Place = { lat: number; lng: number; address: string };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type NominatimItem = {
  place_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
};

/** Build a human label from a Photon feature, de-duping repeated parts. */
function photonLabel(p: NonNullable<PhotonFeature['properties']>): string {
  const line1 = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const parts = [p.name, line1, p.district, p.city ?? p.county, p.state, p.country].filter(Boolean) as string[];
  return Array.from(new Set(parts)).join(', ');
}

/** Build a readable label from a Nominatim hit (display_name is too long). */
function nominatimLabel(it: NominatimItem): string {
  const a = it.address ?? {};
  const locality = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? a.state_district;
  const parts = [it.name, locality, a.state, a.country].filter(Boolean) as string[];
  const label = Array.from(new Set(parts)).join(', ');
  return label || (it.display_name ?? '');
}

/** Photon (OpenStreetMap) — fast type-ahead, coords inline. */
async function photon(q: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  try {
    const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en${bias}`;
    const res = await fetch(url);
    const json = (await res.json()) as { features?: PhotonFeature[] };
    return (json.features ?? [])
      .filter((f) => f.geometry?.coordinates && f.properties)
      .map((f, i) => {
        const [lng, lat] = f.geometry!.coordinates!;
        return { id: `p-${f.properties!.osm_id ?? i}`, label: photonLabel(f.properties!), lat, lng };
      })
      .filter((sug) => sug.label.length > 0);
  } catch {
    return [];
  }
}

/** Nominatim (OpenStreetMap) — broader coverage of named places & POIs. */
async function nominatim(q: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  try {
    // viewbox + bounded=0 prefers nearby hits without excluding distant ones.
    const box = near
      ? `&viewbox=${near.lng - 0.7},${near.lat + 0.7},${near.lng + 0.7},${near.lat - 0.7}&bounded=0`
      : '';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=8${box}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'pass-app/1.0 (free-stuff marketplace)' },
    });
    const arr = (await res.json()) as NominatimItem[];
    return (Array.isArray(arr) ? arr : [])
      .map((it) => ({ id: `n-${it.place_id ?? it.lat}`, label: nominatimLabel(it), lat: +it.lat, lng: +it.lon }))
      .filter((sug) => sug.label.length > 0 && Number.isFinite(sug.lat) && Number.isFinite(sug.lng));
  } catch {
    return [];
  }
}

/** Google Places autocomplete. Returns [] on any non-OK status (denied, no
 * billing, error) so callers can fall back to the free providers. */
async function googlePlaces(q: string): Promise<Suggestion[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_PLACES_KEY}`;
    const res = await fetch(url);
    const json = (await res.json()) as { status?: string; predictions?: { place_id: string; description: string }[] };
    if (json.status !== 'OK') return [];
    return (json.predictions ?? []).map((p) => ({ id: p.place_id, label: p.description }));
  } catch {
    return [];
  }
}

/** As-you-type suggestions. `near` biases results toward a location. */
export async function autocomplete(input: string, near?: { lat: number; lng: number }): Promise<Suggestion[]> {
  const q = input.trim();
  if (q.length < 3) return []; // don't suggest until the user has typed something meaningful

  // Prefer Google when a key is configured AND it actually returns results.
  // If Google fails (no billing / denied / error), fall through to free OSM.
  if (hasPlaces()) {
    const g = await googlePlaces(q);
    if (g.length) return g;
  }

  // Free path: merge Photon (fast typeahead) + Nominatim (broader coverage).
  const [a, b] = await Promise.all([photon(q, near), nominatim(q, near)]);
  const merged: Suggestion[] = [];
  const seen = new Set<string>();
  // Interleave so both providers contribute even when one returns a lot.
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const sug of [a[i], b[i]]) {
      if (!sug) continue;
      const key = `${sug.label.toLowerCase()}|${sug.lat?.toFixed(3)},${sug.lng?.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(sug);
    }
  }

  // Keep each provider's own relevance ranking (they already proximity-bias via
  // `near`); re-sorting by raw distance would bury a far but exact match.
  return merged.slice(0, 8);
}

/** Resolve a suggestion to coordinates + a readable address. */
export async function placeDetails(id: string): Promise<Place | null> {
  // Photon suggestions already carry coords, so this is only hit on the Google
  // path — where the suggestion id is a place_id needing a details lookup.
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

/** Turn a typed address into coordinates. Tries Photon, then the device geocoder. */
export async function geocodeAddress(address: string, near?: { lat: number; lng: number }): Promise<Place | null> {
  const q = address.trim();
  if (!q) return null;
  const hits = await autocomplete(q, near);
  const top = hits.find((h) => h.lat != null && h.lng != null);
  if (top?.lat != null && top.lng != null) return { lat: top.lat, lng: top.lng, address: top.label };
  try {
    const r = await Location.geocodeAsync(q);
    if (r.length) return { lat: r[0].latitude, lng: r[0].longitude, address: q };
  } catch {}
  return null;
}

/** Turn coordinates (e.g. a dropped pin) into a readable address. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Device geocoder first (offline-capable); fall back to Photon reverse.
  try {
    const r = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (r.length) {
      const a = r[0];
      const label = [a.name, a.street, a.district, a.city, a.region].filter(Boolean).join(', ');
      if (label) return label;
    }
  } catch {}
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`);
    const json = (await res.json()) as { features?: PhotonFeature[] };
    const p = json.features?.[0]?.properties;
    if (p) {
      const label = photonLabel(p);
      if (label) return label;
    }
  } catch {}
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
