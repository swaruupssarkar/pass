import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon, type IconName } from '@/pass/icon';
import { CITIES, me, myListings, USERS, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, BottomNav, Btn, Hatch, Screen, shadow, VerifiedBadge } from '@/pass/ui';
import type { UserId } from '@/pass/data';

const ROWS: { icon: IconName; labelKey: string; route: '/manage' | '/impact' | '/saved' | '/safety' | '/settings' }[] = [
  { icon: 'clipboard', labelKey: 'profile.myListings', route: '/manage' },
  { icon: 'star', labelKey: 'profile.myImpact', route: '/impact' },
  { icon: 'heart-outline', labelKey: 'profile.savedItems', route: '/saved' },
  { icon: 'shield', labelKey: 'profile.safetyCenter', route: '/safety' },
  { icon: 'settings', labelKey: 'profile.settings', route: '/settings' },
];

const SWITCH_IDS: UserId[] = ['u1', 'u2'];

export default function Profile() {
  const router = useRouter();
  const tr = useT();
  const { s, switchUser, logout } = usePass();
  const user = me(s);
  const mine = myListings(s);
  const givenCount = mine.filter((l) => l.taken).length;
  const cityName = CITIES.find((c) => c.id === user.cityId)?.name ?? CITIES[0].name;
  const dp = s.dp[s.currentUserId];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* profile card */}
        <View style={{ backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', padding: 20, ...shadow(12, 30, 0.35) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <View style={{ width: 66, height: 66 }}>
              {dp ? (
                <View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: dp, overflow: 'hidden' }}>
                  <Hatch gap={14} />
                </View>
              ) : (
                <Avatar name={user.name} size={66} square />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 }} numberOfLines={1}>{user.name}</Text>
                <VerifiedBadge size={18} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <Icon name="star" size={12.5} color={C.star} />
                <Text style={{ fontSize: 12.5, color: C.muted }}>{user.rating} · {cityName} · {tr('profile.verified')}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}>
            <Pressable onPress={() => router.push('/manage')} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{givenCount}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{tr('profile.given')}</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
            <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{mine.length}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{tr('profile.listings')}</Text>
            </View>
          </View>
        </View>

        {/* user switcher */}
        <View style={{ backgroundColor: C.surface, borderRadius: 18, marginTop: 16, padding: 14, ...shadow(8, 24, 0.3) }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.3, marginBottom: 11 }}>{tr('profile.switchAccount')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {SWITCH_IDS.map((id) => {
              const u = USERS[id];
              const on = s.currentUserId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => switchUser(id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    borderWidth: 1.5,
                    borderColor: on ? C.accent : C.line,
                    backgroundColor: on ? C.accentSoft : C.surface,
                  }}>
                  <Avatar name={u.name} size={34} square tint={on ? C.surface : C.bg} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.ink }} numberOfLines={1}>{u.name}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }} numberOfLines={1}>{on ? tr('profile.active') : tr('profile.tapToSwitch')}</Text>
                  </View>
                  {on ? <Icon name="check-circle" size={17} color={C.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* menu */}
        <View style={{ backgroundColor: C.surface, borderRadius: 18, marginTop: 16, overflow: 'hidden', ...shadow(8, 24, 0.3) }}>
          {ROWS.map((r, i) => (
            <Pressable key={r.route} onPress={() => router.push(r.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, paddingHorizontal: 16, borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
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
          onPress={() => {
            logout();
            router.replace('/');
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
