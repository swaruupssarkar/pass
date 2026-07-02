import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Icon } from '@/pass/icon';
import { autocomplete, geocodeAddress, placeDetails, reverseGeocode, type Suggestion } from '@/pass/places';
import { activeOrigin, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn } from '@/pass/ui';

// Leaflet + OpenStreetMap in a WebView. Works in Expo Go on both platforms,
// needs no API key or billing (react-native-maps' Google provider is blank in
// Expo Go on SDK 55). RN <-> map talk over postMessage / injectJavaScript.
const buildHtml = (lat: number, lng: number, accent: string, bg: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${bg}; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
  .pin { width: 22px; height: 22px; border-radius: 50%; background: ${accent};
    border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var icon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  var marker = L.marker([${lat}, ${lng}], { draggable: true, icon: icon }).addTo(map);
  function post() {
    var p = marker.getLatLng();
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ lat: p.lat, lng: p.lng }));
  }
  marker.on('dragend', post);
  map.on('click', function (e) { marker.setLatLng(e.latlng); post(); });
  window.__setMarker = function (la, ln) { marker.setLatLng([la, ln]); map.setView([la, ln], 16); post(); };
</script>
</body>
</html>`;

export default function PickMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const { s, setPickup, setNotifyAddress } = usePass();
  const webRef = useRef<WebView>(null);
  const notifyMode = useLocalSearchParams().mode === 'notify';
  const done = useRef(false); // one-shot: router.back() must fire once even on double-tap

  const start = notifyMode
    ? s.notify[s.currentUserId]?.addr ?? s.userLoc ?? activeOrigin(s)
    : s.postCoords ?? s.userLoc ?? activeOrigin(s);
  const [coords, setCoords] = useState({ lat: start.lat, lng: start.lng });
  const [query, setQuery] = useState('');
  const [suggests, setSuggests] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [html] = useState(() => buildHtml(start.lat, start.lng, C.accent, C.bg));

  const moveTo = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    webRef.current?.injectJavaScript(`window.__setMarker(${lat}, ${lng}); true;`);
  };

  // debounce keystrokes so we don't hit the geocoder on every letter
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onQuery = (text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) {
      setSuggests([]);
      return;
    }
    const near = coords;
    debounce.current = setTimeout(async () => {
      const r = await autocomplete(text, near);
      setSuggests(r);
    }, 250);
  };

  const pickSuggestion = async (sug: Suggestion) => {
    if (debounce.current) clearTimeout(debounce.current);
    setSuggests([]);
    setQuery(sug.label);
    // Photon suggestions carry coords — move straight to them, no extra lookup.
    if (sug.lat != null && sug.lng != null) {
      moveTo(sug.lat, sug.lng);
      return;
    }
    setBusy(true);
    const place = await placeDetails(sug.id);
    setBusy(false);
    if (place) moveTo(place.lat, place.lng);
  };

  const searchPlain = async () => {
    if (!query.trim()) return;
    if (debounce.current) clearTimeout(debounce.current);
    setSuggests([]);
    setBusy(true);
    const place = await geocodeAddress(query, coords);
    setBusy(false);
    if (place) moveTo(place.lat, place.lng);
  };

  const confirm = async () => {
    if (busy) return; // re-entry guard (double-tap while reverse-geocoding)
    setBusy(true);
    const address = await reverseGeocode(coords.lat, coords.lng);
    if (notifyMode) setNotifyAddress(coords, address);
    else setPickup(coords, address);
    setBusy(false);
    if (done.current) return;
    done.current = true;
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: C.bg }}
        onLoadEnd={() => setMapLoading(false)}
        onMessage={(e) => {
          try {
            const p = JSON.parse(e.nativeEvent.data);
            if (typeof p.lat === 'number' && typeof p.lng === 'number') setCoords({ lat: p.lat, lng: p.lng });
          } catch {}
        }}
      />

      {mapLoading ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : null}

      {/* search */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: radius.md, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -6px rgba(0,0,0,0.3)' }}>
            <Icon name="back" size={20} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: radius.md, paddingHorizontal: 14, height: 46, boxShadow: '0 6px 16px -6px rgba(0,0,0,0.3)' }}>
            <Icon name="search" size={15} color={C.muted} />
            <TextInput
              value={query}
              onChangeText={onQuery}
              onSubmitEditing={searchPlain}
              placeholder={tr('pickmap.searchPlaceholder')}
              placeholderTextColor={C.muted}
              returnKeyType="search"
              style={{ flex: 1, fontSize: 14, color: C.ink }}
            />
            {busy ? <ActivityIndicator size="small" color={C.accent} /> : null}
          </View>
        </View>
        {suggests.length > 0 ? (
          <View style={{ backgroundColor: C.surface, borderRadius: radius.md, marginTop: 8, marginLeft: 52, overflow: 'hidden', boxShadow: '0 8px 20px -10px rgba(0,0,0,0.35)' }}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
              {suggests.map((sug) => (
                <Pressable key={sug.id} onPress={() => pickSuggestion(sug)} style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text style={{ fontSize: 13.5, color: C.ink }} numberOfLines={1}>{sug.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {suggests.length === 0 && query.trim().length >= 2 && !busy ? (
          <Text style={{ marginTop: 8, marginLeft: 52, fontSize: 11.5, color: C.muted, backgroundColor: C.surface, borderRadius: 10, padding: 8 }}>
            {tr('pickmap.noMatch')}
          </Text>
        ) : null}
      </View>

      {/* hint + confirm */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 18 }}>
        <View style={{ backgroundColor: C.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(0,0,0,0.3)' }}>
          <Icon name="pin" size={16} color={C.accent} />
          <Text style={{ flex: 1, fontSize: 12.5, color: C.muted }}>{tr('pickmap.hint')}</Text>
        </View>
        <Btn icon="check" label={tr('pickmap.confirm')} onPress={confirm} disabled={busy} block />
      </View>
    </View>
  );
}
