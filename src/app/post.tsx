import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { autocomplete, geocodeAddress, placeDetails, type Suggestion } from '@/pass/places';
import { CATS, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Pill, Screen } from '@/pass/ui';

const CONDS = ['Like new', 'Good', 'Fair'];

export default function Post() {
  const router = useRouter();
  const { s, patch, addPostPhoto, removePostPhoto, setPickup, submitPost, showAlert } = usePass();
  const editing = !!s.editingId;
  const photos = s.postPhotos;
  const canAdd = photos.length < 4;
  const [suggests, setSuggests] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: 0.7 });
    if (!res.canceled) res.assets.forEach((a) => addPostPhoto(a.uri));
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showAlert('Camera access needed', 'Enable camera permission to take a photo.');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) res.assets.forEach((a) => addPostPhoto(a.uri));
  };

  const onAddress = async (text: string) => {
    patch({ postAddress: text, postCoords: null });
    setSuggests(await autocomplete(text));
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

  const submit = async () => {
    if (!s.postTitle.trim()) return showAlert('Add a title', 'Give your item a short title.');
    if (photos.length === 0) return showAlert('Add a photo', 'Add at least one photo so people can see the item.');
    if (!s.postCoords) {
      // try to resolve a typed address before failing
      if (s.postAddress.trim()) {
        const place = await geocodeAddress(s.postAddress);
        if (place) setPickup({ lat: place.lat, lng: place.lng }, place.address);
        else return showAlert('Set a pickup location', 'Pin it on the map or pick a suggested address.');
      } else {
        return showAlert('Set a pickup location', 'Type an address or pin it on the map.');
      }
    }
    submitPost();
    router.replace('/manage');
  };

  return (
    <Screen bg={C.surface} edges={['top', 'bottom']}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Header title={editing ? 'Edit listing' : 'Post an item'} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Label text="Add photos" hint="(from your gallery or camera)" />
        <View style={{ flexDirection: 'row', gap: 11, flexWrap: 'wrap' }}>
          {photos.map((uri) => (
            <View key={uri} style={{ width: 96, height: 96 }}>
              <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: radius.lg }} contentFit="cover" />
              <Pressable onPress={() => removePostPhoto(uri)} hitSlop={8} style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {canAdd ? (
            <Pressable onPress={pickFromGallery} style={{ width: 96, height: 96, borderRadius: radius.lg, borderWidth: 2, borderColor: C.accent, borderStyle: 'dashed', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add" size={26} color={C.accent} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.accent, marginTop: 2 }}>Gallery</Text>
            </Pressable>
          ) : null}
          {canAdd ? (
            <Pressable onPress={takePhoto} style={{ width: 96, height: 96, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={24} color={C.ink} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.ink, marginTop: 4 }}>Camera</Text>
            </Pressable>
          ) : null}
        </View>

        <Label text="Title" top />
        <Input value={s.postTitle} onChangeText={(postTitle) => patch({ postTitle })} placeholder="e.g. Wooden study table" />

        <Label text="Category" top />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATS.map((c) => (
            <Pill key={c} label={c} selected={s.postCat === c} tone="soft" onPress={() => patch({ postCat: c })} />
          ))}
        </View>

        <Label text="Condition" top />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONDS.map((c) => (
            <Pill key={c} label={c} selected={s.postCond === c} tone="soft" onPress={() => patch({ postCond: c })} />
          ))}
        </View>

        {/* pickup location: type (autocomplete) or pin on map */}
        <Label text="Pickup location" top />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.bg, borderWidth: 1, borderColor: s.postCoords ? C.free : C.line, borderRadius: radius.md, padding: 14 }}>
          <Icon name="pin" size={16} color={s.postCoords ? C.free : C.accent} />
          <TextInput
            value={s.postAddress}
            onChangeText={onAddress}
            onBlur={geocodeTyped}
            placeholder="Type a home or pickup address"
            placeholderTextColor={C.muted}
            style={{ flex: 1, fontSize: 14, color: C.ink }}
          />
          {busy ? <ActivityIndicator size="small" color={C.accent} /> : s.postCoords ? <Icon name="check-circle" size={18} color={C.free} /> : null}
        </View>
        {suggests.length > 0 ? (
          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, marginTop: 6, overflow: 'hidden' }}>
            {suggests.map((sug) => (
              <Pressable key={sug.id} onPress={() => pickSuggestion(sug)} style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 13.5, color: C.ink }} numberOfLines={1}>{sug.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable onPress={() => router.push('/pickmap')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'flex-start' }}>
          <Icon name="map" size={16} color={C.accent} />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.accent }}>Pin on map instead</Text>
        </Pressable>
        <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 7, lineHeight: 18 }}>
          Only the approximate area shows publicly. Your exact address is shared only with the person you accept.
        </Text>

        <Label text="Availability" top />
        <Input value={s.postAvail} onChangeText={(postAvail) => patch({ postAvail })} placeholder="e.g. Evenings after 6pm" />
      </ScrollView>

      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn label={editing ? 'Save changes' : 'Post for free'} onPress={submit} block />
      </View>
    </Screen>
  );
}

function Label({ text, hint, top }: { text: string; hint?: string; top?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginTop: top ? 18 : 0, marginBottom: 8 }}>
      {text} {hint ? <Text style={{ color: C.muted, fontWeight: '500' }}>{hint}</Text> : null}
    </Text>
  );
}

function Input({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 14, fontSize: 14, color: C.ink }} />
  );
}
