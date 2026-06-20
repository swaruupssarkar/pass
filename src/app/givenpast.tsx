import { ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { USERS, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Header, PhotoTile, Screen, shadow } from '@/pass/ui';

export default function GivenPast() {
  const { s } = usePass();
  const id = s.activePersonId ?? s.currentUserId;
  const list = s.listings.filter((l) => l.ownerId === id && l.taken);

  return (
    <Screen>
      <Header title={`Given by ${USERS[id].name}`} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, marginLeft: 52 }}>
          <Text style={{ fontSize: 13, color: C.muted }}>{list.length} items passed on</Text>
          <Icon name="gift" size={13} color={C.muted} />
        </View>
        {list.length === 0 ? (
          <Text style={{ fontSize: 13, color: C.muted, marginLeft: 52 }}>No items given yet.</Text>
        ) : (
          <View style={{ gap: 11 }}>
            {list.map((l) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: C.surface, borderRadius: radius.lg, padding: 11, ...shadow(8, 20, 0.4) }}>
                <PhotoTile tint={l.tint} uri={l.photos?.[0]} gap={14} style={{ width: 62, height: 62, borderRadius: radius.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{l.title}</Text>
                  <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }} numberOfLines={1}>
                    {l.takenBy ? `Given to ${USERS[l.takenBy].name}` : 'Given'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                  <Icon name="check" size={13} color={C.free} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>Given</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
