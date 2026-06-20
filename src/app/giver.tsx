import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CITIES, USERS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { distLabel, fmtAgo, otherOf, reviewsFor, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, FreeTag, Header, PhotoTile, Screen, shadow, t, VerifiedBadge } from '@/pass/ui';

export default function Giver() {
  const router = useRouter();
  const tr = useT();
  const { s, openListing, openThreadFor } = usePass();

  const id = s.activePersonId ?? otherOf(s.currentUserId).id;
  const person = USERS[id];
  const city = CITIES.find((c) => c.id === person.cityId);

  const live = s.listings.filter((l) => l.ownerId === id && !l.taken);
  const given = s.listings.filter((l) => l.ownerId === id && l.taken).length;
  const reviews = reviewsFor(s, id);

  const open = (lid: string) => {
    openListing(lid);
    router.push('/detail');
  };

  const message = () => {
    const first = s.listings.find((l) => l.ownerId === id);
    if (first) {
      openThreadFor(first.id);
      router.push('/thread');
    }
  };

  return (
    <Screen>
      <Header title={tr('giver.title')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 18 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', padding: 20, ...shadow(12, 30, 0.35) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <Avatar name={person.name} size={64} square />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 }}>{person.name}</Text>
                  <VerifiedBadge size={18} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                  <Icon name="star" size={12.5} color={C.star} />
                  <Text style={{ fontSize: 12.5, color: C.muted }}>{person.rating} · {tr('giver.memberSince', { year: person.since })}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Icon name="pin" size={12.5} color={C.muted} />
                  <Text style={{ fontSize: 12.5, color: C.muted }}>{city?.name}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}>
              <Stat n={live.length} label={tr('giver.liveListings')} />
              <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
              <Stat n={given} label={tr('giver.given')} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[t.h3, { fontSize: 17 }]}>{tr('giver.giveaways', { name: person.name })}</Text>
          {live.length > 0 && (
            <View style={{ backgroundColor: '#E4F0E9', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.free }}>{tr('giver.liveCount', { count: live.length })}</Text>
            </View>
          )}
        </View>
        {live.length === 0 && (
          <View style={{ paddingHorizontal: 18 }}>
            <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, padding: 16 }}>
              <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 19 }}>{tr('giver.noGiveaways')}</Text>
            </View>
          </View>
        )}
        <View style={{ paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {live.map((l) => (
            <Pressable key={l.id} onPress={() => open(l.id)} style={{ width: '48%', backgroundColor: C.surface, borderRadius: 18, borderCurve: 'continuous', padding: 8, marginBottom: 13, ...shadow(10, 26, 0.4) }}>
              <PhotoTile tint={l.tint} uri={l.photos?.[0]} gap={18} style={{ aspectRatio: 1, borderRadius: 13 }}>
                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(28,24,22,0.6)', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{distLabel(s, l)}</Text>
                </View>
                <FreeTag small style={{ position: 'absolute', bottom: 8, left: 8 }} />
              </PhotoTile>
              <View style={{ paddingHorizontal: 5, paddingTop: 10, paddingBottom: 5 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '800', color: C.ink, letterSpacing: -0.2 }}>{l.title}</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{l.cat}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={[t.title, { paddingHorizontal: 18, paddingTop: 22 }]}>{tr('giver.whatPeopleSay')}</Text>
        <View style={{ paddingHorizontal: 18, paddingTop: 10, gap: 11 }}>
          {reviews.length === 0 ? (
            <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, padding: 16 }}>
              <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 19 }}>{tr('giver.noReviews')}</Text>
            </View>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: C.surface, borderRadius: radius.lg, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={13} color={C.star} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, color: C.accent, fontWeight: '700' }}>{USERS[r.from].name}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, fontWeight: '600' }}>· {fmtAgo(r.ts)}</Text>
                </View>
                {r.tags.length > 0 ? (
                  <Text style={{ fontSize: 12, color: C.muted, marginBottom: r.text ? 6 : 0 }}>{r.tags.map((tag) => tr('rate.tag.' + tag)).join(' · ')}</Text>
                ) : null}
                {r.text ? <Text style={{ fontSize: 13.5, color: C.ink, lineHeight: 19 }}>{r.text}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 18, paddingVertical: 13, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn label={tr('giver.message', { name: person.name })} onPress={message} block />
      </View>
    </Screen>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink }}>{n}</Text>
      <Text style={{ fontSize: 11.5, color: C.muted }}>{label}</Text>
    </View>
  );
}
