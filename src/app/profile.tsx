import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/pass/icon';
import { CITIES, handoffsTo, me, myHandoffs, myListings, reviewsFor, userName, userRating, usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';
import { Avatar, BottomNav, Btn, Screen, shadow, VerifiedBadge } from '@/pass/ui';

const ROWS: { icon: IconName; labelKey: string; route: '/manage' | '/impact' | '/saved' | '/safety' | '/settings'; params?: Record<string, string> }[] = [
  { icon: 'clipboard', labelKey: 'profile.myListings', route: '/manage' },
  { icon: 'star', labelKey: 'profile.myImpact', route: '/impact' },
  { icon: 'heart-outline', labelKey: 'profile.savedItems', route: '/saved' },
  { icon: 'time', labelKey: 'profile.requested', route: '/saved', params: { tab: 'requested' } },
  { icon: 'shield', labelKey: 'profile.safetyCenter', route: '/safety' },
  { icon: 'settings', labelKey: 'profile.settings', route: '/settings' },
];

export default function Profile() {
  const router = useRouter();
  const tr = useT();
  const { s, logout, setName, setDp } = usePass();
  const user = me(s);
  const mine = myListings(s);
  const givenCount = myHandoffs(s).length;
  const receivedCount = handoffsTo(s, s.currentUserId).length;
  const cityName = CITIES.find((c) => c.id === user.cityId)?.name ?? CITIES[0].name;
  const dp = s.dp[s.currentUserId];
  const name = userName(s, s.currentUserId);
  const rating = userRating(s, s.currentUserId);
  const reviewCount = reviewsFor(s, s.currentUserId).length;

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setDp(res.assets[0].uri);
  };
  const startEditName = () => {
    setDraftName(name);
    setEditing(true);
  };
  const saveName = () => {
    setName(draftName);
    setEditing(false);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* profile card */}
        <View style={{ backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', padding: 20, ...shadow(12, 30, 0.35) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <Pressable onPress={changePhoto} style={{ width: 66, height: 66 }}>
              <Avatar name={name} uri={dp} size={66} square />
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface }}>
                <Icon name="camera" size={12} color="#fff" />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              {editing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    autoFocus
                    onSubmitEditing={saveName}
                    returnKeyType="done"
                    style={{ flex: 1, fontSize: 19, fontWeight: '800', color: C.ink, borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingVertical: 2 }}
                  />
                  <Pressable onPress={saveName} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={16} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 }} numberOfLines={1}>{name}</Text>
                  <VerifiedBadge size={18} />
                  <Pressable onPress={startEditName} hitSlop={8}>
                    <Icon name="pencil" size={15} color={C.muted} />
                  </Pressable>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <Icon name="star" size={12.5} color={C.star} />
                <Text style={{ fontSize: 12.5, color: C.muted }}>{rating != null ? rating : tr('common.new')}{reviewCount > 0 ? ` · ${tr('common.reviewsN', { n: reviewCount })}` : ''} · {cityName} · {tr('profile.verified')}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}>
            <Pressable onPress={() => router.push('/manage')} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{givenCount}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{tr('profile.given')}</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
            <Pressable onPress={() => router.push('/saved')} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{receivedCount}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{tr('profile.received')}</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
            <Pressable onPress={() => router.push('/manage')} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{mine.length}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{tr('profile.listings')}</Text>
            </Pressable>
          </View>
        </View>

        {/* menu */}
        <View style={{ backgroundColor: C.surface, borderRadius: 18, marginTop: 16, overflow: 'hidden', ...shadow(8, 24, 0.3) }}>
          {ROWS.map((r, i) => (
            <Pressable key={r.labelKey} onPress={() => router.push({ pathname: r.route, params: r.params })} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, paddingHorizontal: 16, borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={17} color={C.accent} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.ink }}>{tr(r.labelKey)}</Text>
              <Icon name="forward" size={20} color={C.muted} />
            </Pressable>
          ))}
        </View>

        {/* logout */}
        <Btn
          icon="back"
          label={tr('profile.logout')}
          variant="outline"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
          block
          style={{ marginTop: 16, paddingVertical: 14 }}
          textStyle={{ fontSize: 15, color: C.muted }}
        />
      </ScrollView>

      <BottomNav active="profile" />
    </Screen>
  );
}
