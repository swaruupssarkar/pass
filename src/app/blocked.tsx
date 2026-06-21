import { ScrollView, Text, View } from 'react-native';

import { USERS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { blockedUserIds, CITIES, userName, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, Header, Screen, shadow } from '@/pass/ui';

export default function Blocked() {
  const tr = useT();
  const { s, unblockUser } = usePass();
  const blocked = blockedUserIds(s);

  return (
    <Screen>
      <Header title={tr('blocked.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 16 }}>{tr('blocked.subtitle')}</Text>

        {blocked.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 70 }}>
            <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield" size={32} color={C.accent} />
            </View>
            <Text style={{ fontSize: 14, color: C.muted, marginTop: 16, textAlign: 'center' }}>{tr('blocked.none')}</Text>
          </View>
        ) : (
          <View style={{ gap: 11 }}>
            {blocked.map((id) => {
              const city = CITIES.find((c) => c.id === USERS[id].cityId);
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 13, ...shadow(8, 20, 0.35) }}>
                  <Avatar name={userName(s, id)} uri={s.dp[id]} size={46} square />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{userName(s, id)}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }} numberOfLines={1}>{city?.name ?? ''}</Text>
                  </View>
                  <Btn label={tr('thread.unblock')} variant="outline" onPress={() => unblockUser(id)} style={{ paddingVertical: 10, paddingHorizontal: 18 }} textStyle={{ fontSize: 13.5 }} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
