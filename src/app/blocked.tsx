import { ScrollView, Text, View } from 'react-native';

import { USERS, type UserId } from '@/pass/data';
import { CITIES, iBlocked, userName, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, Header, Screen, shadow } from '@/pass/ui';

export default function Blocked() {
  const tr = useT();
  const { s, blockUser, unblockUser, showConfirm } = usePass();
  const others = (Object.keys(USERS) as UserId[]).filter((id) => id !== s.currentUserId);

  const confirmBlock = (id: UserId) =>
    showConfirm({
      title: tr('thread.blockTitle', { name: userName(s, id) }),
      message: tr('thread.blockMsg'),
      confirmLabel: tr('thread.block'),
      destructive: true,
      onConfirm: () => blockUser(id),
    });

  return (
    <Screen>
      <Header title={tr('blocked.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 16 }}>{tr('blocked.subtitle')}</Text>

        <View style={{ gap: 11 }}>
          {others.map((id) => {
            const blocked = iBlocked(s, id);
            const city = CITIES.find((c) => c.id === USERS[id].cityId);
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 13, ...shadow(8, 20, 0.35) }}>
                <Avatar name={userName(s, id)} uri={s.dp[id]} size={46} square />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{userName(s, id)}</Text>
                  <Text style={{ fontSize: 12, color: blocked ? C.dangerInk : C.muted, marginTop: 2 }} numberOfLines={1}>
                    {blocked ? tr('blocked.blockedTag') : city?.name ?? ''}
                  </Text>
                </View>
                {blocked ? (
                  <Btn label={tr('thread.unblock')} variant="outline" onPress={() => unblockUser(id)} style={{ paddingVertical: 10, paddingHorizontal: 18 }} textStyle={{ fontSize: 13.5 }} />
                ) : (
                  <Btn label={tr('thread.block')} variant="outline" onPress={() => confirmBlock(id)} style={{ paddingVertical: 10, paddingHorizontal: 18, borderColor: C.dangerBorder }} textStyle={{ fontSize: 13.5, color: C.dangerInk }} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
