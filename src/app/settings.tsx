import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { activeLocationLabel, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Header, Pill, Screen, Toggle } from '@/pass/ui';

const RADIUS_PRESETS = [3, 5, 10, 20, 100];

export default function Settings() {
  const router = useRouter();
  const { s, patch, logout } = usePass();
  const city = activeLocationLabel(s);

  const [notifNear, setNotifNear] = useState(true);
  const [notifChat, setNotifChat] = useState(true);

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
          <View style={{ padding: 15, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14.5, color: C.ink, marginBottom: 11 }}>Default search radius</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {RADIUS_PRESETS.map((km) => (
                <Pill key={km} label={`${km} km`} selected={s.radius === km} onPress={() => patch({ radius: km })} />
              ))}
            </View>
          </View>
        </Section>

        <Section title="NOTIFICATIONS">
          <ToggleRow label="New items near me" on={notifNear} onPress={() => setNotifNear((v) => !v)} divider />
          <ToggleRow label="Chat & request updates" on={notifChat} onPress={() => setNotifChat((v) => !v)} />
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

function ToggleRow({ label, on, onPress, divider }: { label: string; on: boolean; onPress: () => void; divider?: boolean }) {
  return (
    <View style={[row, divider && { borderBottomWidth: 1, borderBottomColor: C.line }]}>
      <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{label}</Text>
      <Toggle on={on} onPress={onPress} />
    </View>
  );
}

const row = { flexDirection: 'row', alignItems: 'center', padding: 15, paddingHorizontal: 16 } as const;
