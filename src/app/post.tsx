import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { catIcon, Icon, type IconName } from '@/pass/icon';
import { autocomplete, geocodeAddress, placeDetails, reverseGeocode, type Suggestion } from '@/pass/places';
import { CATS, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, shadow } from '@/pass/ui';

const CONDS: { key: string; icon: IconName }[] = [
  { key: 'Like new', icon: 'celebrate' },
  { key: 'Good', icon: 'check-circle' },
  { key: 'Fair', icon: 'clipboard' },
];

export default function Post() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, addPostPhoto, removePostPhoto, setPickup, submitPost, showAlert } = usePass();
  const editing = !!s.editingId;
  const photos = s.postPhotos;
  const canAdd = photos.length < 4;
  const [suggests, setSuggests] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const lastQuery = useRef('');

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.7 });
    if (!res.canceled) res.assets.forEach((a) => addPostPhoto(a.uri));
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showAlert(tr('post.cameraNeededTitle'), tr('post.cameraNeededMsg'));
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) res.assets.forEach((a) => addPostPhoto(a.uri));
  };

  const onAddress = async (text: string) => {
    patch({ postAddress: text, postCoords: null });
    lastQuery.current = text;
    if (text.trim().length < 3) {
      setSuggests([]); // empty / too short → no list (clear immediately, no await)
      return;
    }
    const res = await autocomplete(text);
    if (lastQuery.current !== text) return; // a newer keystroke happened — drop this stale result
    setSuggests(res);
  };
  const pickSuggestion = async (sug: Suggestion) => {
    setSuggests([]);
    setBusy(true);
    const place = await placeDetails(sug.id);
    setBusy(false);
    if (place) setPickup({ lat: place.lat, lng: place.lng }, place.address);
    else patch({ postAddress: sug.label });
  };
  const geocodeTyped = async () => {
    if (s.postCoords || !s.postAddress.trim()) return;
    setBusy(true);
    const place = await geocodeAddress(s.postAddress);
    setBusy(false);
    if (place) setPickup({ lat: place.lat, lng: place.lng }, place.address);
  };
  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return showAlert(tr('post.setPickupTitle'), tr('post.privacyNote'));
    setSuggests([]);
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const label = await reverseGeocode(coords.lat, coords.lng);
      setPickup(coords, label || '');
    } catch {
      /* ignore */
    }
    setBusy(false);
  };

  const submit = async () => {
    if (!s.postTitle.trim()) return showAlert(tr('post.addTitleTitle'), tr('post.addTitleMsg'));
    if (photos.length === 0) return showAlert(tr('post.addPhotoTitle'), tr('post.addPhotoMsg'));
    if (!s.postCoords) {
      if (s.postAddress.trim()) {
        const place = await geocodeAddress(s.postAddress);
        if (place) setPickup({ lat: place.lat, lng: place.lng }, place.address);
        else return showAlert(tr('post.setPickupTitle'), tr('post.setPickupMsgPin'));
      } else {
        return showAlert(tr('post.setPickupTitle'), tr('post.setPickupMsgType'));
      }
    }
    submitPost();
    // new posts → celebration; edits → back to My listings
    router.replace(editing ? '/manage' : '/posted');
  };

  return (
    <Screen bg={C.bg} edges={['top', 'bottom']}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', ...shadow(8, 18, 0.3) }}>
          <Icon name="back" size={22} color={C.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4 }}>{editing ? tr('post.editTitle') : tr('post.postTitle')}</Text>
          <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }} numberOfLines={1}>{tr('post.subtitle')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* photos */}
          <Section title={tr('post.photos')} sub={tr('post.photosHint')} hint={`${photos.length}/4`}>
            {photos.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 11, flexWrap: 'wrap' }}>
                {photos.map((uri) => (
                  <View key={uri} style={{ width: 88, height: 88 }}>
                    <Image source={{ uri }} style={{ width: 88, height: 88, borderRadius: radius.md }} contentFit="cover" />
                    <Pressable onPress={() => removePostPhoto(uri)} hitSlop={8} style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {canAdd ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={pickFromGallery} style={{ flex: 1, height: 104, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.accent, borderStyle: 'dashed', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="image" size={26} color={C.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.accent }}>{tr('post.addFromGallery')}</Text>
                </Pressable>
                <Pressable onPress={takePhoto} style={{ flex: 1, height: 104, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="camera" size={24} color={C.ink} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink }}>{tr('post.takePhoto')}</Text>
                </Pressable>
              </View>
            ) : null}
          </Section>

          {/* title */}
          <Section title={tr('post.titleLabel')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, ...inputBox }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clipboard" size={15} color={C.accent} />
              </View>
              <TextInput value={s.postTitle} onChangeText={(postTitle) => patch({ postTitle })} placeholder={tr('post.titlePlaceholder')} placeholderTextColor={C.muted} style={{ flex: 1, fontSize: 15, color: C.ink }} />
            </View>
          </Section>

          {/* category — uniform 3-column grid (no ragged trailing gap) */}
          <Section title={tr('post.category')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 }}>
              {CATS.map((c) => {
                const on = s.postCat === c;
                return (
                  <Pressable key={c} onPress={() => patch({ postCat: c })} style={{ width: '31.5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: on ? C.accent : C.surface, borderWidth: 1, borderColor: on ? C.accent : C.line }}>
                    <Icon name={catIcon(c)} size={15} color={on ? '#fff' : C.accent} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 12.5, fontWeight: '700', color: on ? '#fff' : C.ink }}>{tr('cat.' + c)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* condition */}
          <Section title={tr('post.condition')}>
            <View style={{ flexDirection: 'row', gap: 9 }}>
              {CONDS.map((c) => {
                const on = s.postCond === c.key;
                return (
                  <Pressable key={c.key} onPress={() => patch({ postCond: c.key })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.pill, backgroundColor: on ? C.accentSoft : C.surface, borderWidth: 1.5, borderColor: on ? C.accent : C.line }}>
                    <Icon name={c.icon} size={15} color={on ? C.accent : C.muted} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: on ? C.accent : C.ink }}>{tr('cond.' + c.key)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* pickup */}
          <Section title={tr('post.pickupLocation')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.surface, borderWidth: 1.5, borderColor: s.postCoords ? C.free : C.line, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, height: 52 }}>
              <Icon name="pin" size={16} color={s.postCoords ? C.free : C.accent} />
              <TextInput value={s.postAddress} onChangeText={onAddress} onBlur={geocodeTyped} placeholder={tr('post.addressPlaceholder')} placeholderTextColor={C.muted} style={{ flex: 1, fontSize: 14, color: C.ink }} />
              {busy ? (
                <ActivityIndicator size="small" color={C.accent} style={{ marginRight: 6 }} />
              ) : (
                <Pressable onPress={useMyLocation} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pin" size={17} color={C.accent} />
                </Pressable>
              )}
            </View>

            {suggests.length > 0 ? (
              <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, marginTop: 6, overflow: 'hidden' }}>
                {suggests.map((sug) => (
                  <Pressable key={sug.id} onPress={() => pickSuggestion(sug)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                    <Icon name="pin" size={14} color={C.muted} />
                    <Text style={{ flex: 1, fontSize: 13.5, color: C.ink }} numberOfLines={1}>{sug.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{tr('post.or')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
            </View>
            <Btn icon="map" label={tr('post.pinOnMap')} variant="accentOutline" onPress={() => router.push('/pickmap')} block style={{ marginTop: 10, paddingVertical: 13 }} textStyle={{ fontSize: 14.5 }} />

            {s.postCoords ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#E4F0E9', borderRadius: radius.md, padding: 11 }}>
                <Icon name="check-circle" size={16} color={C.free} />
                <Text style={{ flex: 1, fontSize: 12.5, color: C.ink }} numberOfLines={2}>{s.postAddress || tr('post.pinnedOnMap')}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 }}>
                <Icon name="shield" size={13} color={C.muted} />
                <Text style={{ flex: 1, fontSize: 11.5, color: C.muted, lineHeight: 17 }}>{tr('post.privacyNote')}</Text>
              </View>
            )}
          </Section>

          {/* availability */}
          <Section title={tr('post.availability')}>
            <View style={inputBox}>
              <TextInput value={s.postAvail} onChangeText={(postAvail) => patch({ postAvail })} placeholder={tr('post.availabilityPlaceholder')} placeholderTextColor={C.muted} style={{ fontSize: 15, color: C.ink }} />
            </View>
          </Section>
        </ScrollView>

        <View style={{ padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface }}>
          <Btn icon="gift" label={editing ? tr('post.saveChanges') : tr('post.postForFree')} onPress={submit} block style={{ borderRadius: radius.lg }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const inputBox = { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, borderCurve: 'continuous' as const, paddingHorizontal: 12, height: 52, justifyContent: 'center' as const };

function Section({ title, sub, hint, children }: { title: string; sub?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 16, gap: 13, ...shadow(8, 20, 0.25) }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{title}</Text>
          {sub ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        {hint ? <Text style={{ fontSize: 13, fontWeight: '800', color: C.accent }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}
