import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/pass/icon';
import { hasPlaces } from '@/pass/config';
import { autocomplete, geocodeAddress, placeDetails, reverseGeocode, type Suggestion } from '@/pass/places';
import { activeOrigin, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn } from '@/pass/ui';

export default function PickMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { s, setPickup, setNotifyAddress } = usePass();
  const mapRef = useRef<MapView>(null);
  const notifyMode = useLocalSearchParams().mode === 'notify';

  const start = notifyMode
    ? s.notify[s.currentUserId].addr ?? s.userLoc ?? activeOrigin(s)
    : s.postCoords ?? s.userLoc ?? activeOrigin(s);
  const [coords, setCoords] = useState({ lat: start.lat, lng: start.lng });
  const [query, setQuery] = useState('');
  const [suggests, setSuggests] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);

  const region: Region = { latitude: start.lat, longitude: start.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };

  const moveTo = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
  };

  const onQuery = async (text: string) => {
    setQuery(text);
    setSuggests(await autocomplete(text));
  };

  const pickSuggestion = async (sug: Suggestion) => {
    setSuggests([]);
    setQuery(sug.label);
    setBusy(true);
    const place = await placeDetails(sug.id);
    setBusy(false);
    if (place) moveTo(place.lat, place.lng);
  };

  const searchPlain = async () => {
    if (!query.trim()) return;
    setBusy(true);
    const place = await geocodeAddress(query);
    setBusy(false);
    if (place) moveTo(place.lat, place.lng);
  };

  const confirm = async () => {
    setBusy(true);
    const address = await reverseGeocode(coords.lat, coords.lng);
    if (notifyMode) setNotifyAddress(coords, address);
    else setPickup(coords, address);
    setBusy(false);
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        onPress={(e) => setCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}>
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          draggable
          onDragEnd={(e) => setCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          pinColor={C.accent}
        />
      </MapView>

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
              placeholder="Search address"
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
        {!hasPlaces() ? (
          <Text style={{ marginTop: 8, marginLeft: 52, fontSize: 11.5, color: C.muted, backgroundColor: C.surface, borderRadius: 10, padding: 8 }}>
            Tip: set a Google Places key for live suggestions. For now, type an address and press search, or drag the pin.
          </Text>
        ) : null}
      </View>

      {/* hint + confirm */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 18 }}>
        <View style={{ backgroundColor: C.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(0,0,0,0.3)' }}>
          <Icon name="pin" size={16} color={C.accent} />
          <Text style={{ flex: 1, fontSize: 12.5, color: C.muted }}>Tap the map or drag the pin to the exact pickup spot.</Text>
        </View>
        <Btn icon="check" label="Confirm pickup here" onPress={confirm} block />
      </View>
    </View>
  );
}
