import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Notification } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { fmtAgo, notificationsFor, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { EmptyState, Header, Screen, shadow } from '@/pass/ui';

const ICON_FOR = (kind: Notification['kind']) => (kind === 'taken' ? 'gift' : kind === 'item' ? 'pin' : 'chat');

export default function Notifs() {
  const router = useRouter();
  const tr = useT();
  const { s, openNotif, markNotifsRead, deleteNotif, clearNotifs, showConfirm } = usePass();
  const list = notificationsFor(s);
  const hasUnread = list.some((n) => !n.read);

  const open = (n: Notification) => {
    const route = openNotif(n);
    if (route) router.push(route as Href);
  };
  const clearAll = () =>
    showConfirm({
      title: tr('notifs.clearTitle'),
      message: tr('notifs.clearMessage'),
      confirmLabel: tr('notifs.clearAll'),
      destructive: true,
      onConfirm: clearNotifs,
    });

  return (
    <Screen>
      <Header
        title={tr('notifs.title')}
        right={
          list.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {hasUnread ? (
                <Pressable onPress={markNotifsRead} hitSlop={6}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>{tr('notifs.readAll')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={clearAll} hitSlop={6}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.dangerInk }}>{tr('notifs.clear')}</Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />
      {list.length === 0 ? (
        <EmptyState icon="bell" title={tr('notifs.empty')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 24, gap: 10 }}>
          {list.map((n) => (
            <ReanimatedSwipeable
              key={n.id}
              renderRightActions={() => (
                <Pressable
                  onPress={() => deleteNotif(n.id)}
                  style={{ width: 78, marginLeft: 8, backgroundColor: C.dangerBg, borderRadius: radius.lg, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" size={22} color={C.dangerInk} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.dangerInk, marginTop: 4 }}>{tr('common.delete')}</Text>
                </Pressable>
              )}>
              <Pressable
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
            </ReanimatedSwipeable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
