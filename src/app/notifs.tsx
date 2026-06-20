import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { Notification } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { fmtAgo, notificationsFor, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Header, Screen, shadow } from '@/pass/ui';

const ICON_FOR = (kind: Notification['kind']) => (kind === 'taken' ? 'gift' : 'chat');

export default function Notifs() {
  const router = useRouter();
  const { s, openNotif } = usePass();
  const list = notificationsFor(s);

  const open = (n: Notification) => {
    const route = openNotif(n);
    if (route) router.push(route as Href);
  };

  return (
    <Screen>
      <Header title="Notifications" />
      {list.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={32} color={C.accent} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 16 }}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 24, gap: 10 }}>
          {list.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => open(n)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 13, ...shadow(8, 20, 0.4) }}>
              <View style={{ width: 46, height: 46, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ICON_FOR(n.kind)} size={20} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{n.title}</Text>
                <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 17 }}>{n.body}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ fontSize: 11, color: C.muted }}>{fmtAgo(n.ts)}</Text>
                {!n.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent }} /> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
