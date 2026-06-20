import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { activeLocationLabel, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Header, Screen, Toggle } from '@/pass/ui';

export default function Settings() {
  const router = useRouter();
  const { s, logout, setNotifyNear, setNotifyChat } = usePass();
  const city = activeLocationLabel(s);
  const np = s.notify[s.currentUserId];

  const onLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Section title="LOCATION">
          <Pressable onPress={() => router.push('/city')} style={[row, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>City</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14, color: C.muted, fontWeight: '600' }}>{city}</Text>
              <Icon name="forward" size={16} color={C.muted} />
            </View>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/pickmap', params: { mode: 'notify' } })} style={row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, color: C.ink }}>Notify address</Text>
              <Text style={{ fontSize: 12, color: np.addr ? C.free : C.muted, marginTop: 2 }} numberOfLines={1}>
                {np.addr ? np.addr.label : 'Set on map for nearby alerts'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={16} color={C.accent} />
              <Icon name="forward" size={16} color={C.muted} />
            </View>
          </Pressable>
        </Section>

        <Section title="NOTIFICATIONS">
          <View style={[row, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 14.5, color: C.ink }}>New items near me</Text>
              <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 16 }}>
                Alert me when someone posts within 100 km of my notify address.
              </Text>
            </View>
            <Toggle on={np.near} onPress={() => setNotifyNear(!np.near)} />
          </View>
          <View style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>Chat &amp; request updates</Text>
            <Toggle on={np.chat} onPress={() => setNotifyChat(!np.chat)} />
          </View>
        </Section>

        <Section title="LANGUAGE">
          <View style={[row, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>English</Text>
            <Icon name="check" size={16} color={C.accent} />
          </View>
          <View style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.muted }}>বাংলা · हिन्दी · தமிழ் · ಕನ್ನಡ</Text>
            <View style={{ backgroundColor: C.bg, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.muted }}>Soon</Text>
            </View>
          </View>
        </Section>

        <Section title="PRIVACY">
          <Pressable onPress={() => router.push('/safety')} style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>Safety center</Text>
            <Icon name="forward" size={18} color={C.muted} />
          </Pressable>
        </Section>

        <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
          <Pressable onPress={onLogout} style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.accent, fontWeight: '700' }}>Log out</Text>
            <Icon name="forward" size={18} color={C.accent} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 9, marginLeft: 4 }}>{title}</Text>
      <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

const row = { flexDirection: 'row', alignItems: 'center', padding: 15, paddingHorizontal: 16 } as const;
