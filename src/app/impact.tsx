import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { fmtAgo, myListings, reviewsFor, USERS, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Header, ReviewCard, Screen, shadow, t } from '@/pass/ui';

export default function Impact() {
  const router = useRouter();
  const tr = useT();
  const { s, viewPerson } = usePass();
  const openPerson = (id: typeof s.currentUserId) => {
    viewPerson(id);
    router.push('/giver');
  };
  const given = myListings(s).filter((l) => l.taken);
  const n = given.length;
  const reviews = reviewsFor(s, s.currentUserId);
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '—';

  return (
    <Screen>
      <Header title={tr('impact.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: C.accent, borderRadius: 24, borderCurve: 'continuous', padding: 22, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View style={{ position: 'absolute', bottom: -50, right: 30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gift" size={22} color="#fff" />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff', opacity: 0.92, marginTop: 16 }}>{tr('impact.givenAway')}</Text>
          <Text style={{ fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1.5, marginTop: 6 }}>{tr(n === 1 ? 'impact.itemCountOne' : 'impact.itemCountOther', { count: n })}</Text>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: radius.xl, marginTop: 14, paddingVertical: 18, ...shadow(10, 26, 0.35) }}>
          <Stat n={String(n)} label={tr('impact.statGiven')} />
          <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
          <Stat n={String(reviews.length)} label={tr('impact.statReviews')} />
          <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
          <Stat n={avg} label={tr('impact.statRating')} />
        </View>

        <Text style={[t.title, { marginTop: 24, marginBottom: 12 }]}>{tr('impact.recentHandoffs')}</Text>
        {n === 0 ? (
          <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, padding: 18, ...shadow(8, 20, 0.35) }}>
            <Text style={[t.muted, { textAlign: 'center' }]}>{tr('impact.noHandoffs')}</Text>
          </View>
        ) : (
          <View style={{ gap: 11 }}>
            {given.map((l) => {
              const name = l.takenBy ? USERS[l.takenBy].name : tr('impact.someone');
              return (
                <View key={l.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, ...shadow(8, 20, 0.35) }}>
                  <Avatar name={name} uri={l.takenBy ? s.dp[l.takenBy] : null} size={40} tint={l.tint} color={C.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, color: C.ink, lineHeight: 19 }}>{tr('impact.received', { name, title: l.title })}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[t.title, { marginTop: 24, marginBottom: 12 }]}>{tr('impact.reviews')}</Text>
        {reviews.length === 0 ? (
          <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, padding: 18, ...shadow(8, 20, 0.35) }}>
            <Text style={[t.muted, { textAlign: 'center' }]}>{tr('impact.noReviews')}</Text>
          </View>
        ) : (
          <View style={{ gap: 11 }}>
            {reviews.map((r) => (
              <ReviewCard key={r.id} rating={r.rating} tags={r.tags} text={r.text} author={USERS[r.from].name} time={fmtAgo(r.ts)} onAuthorPress={() => openPerson(r.from)} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>{n}</Text>
      <Text style={{ fontSize: 12, color: C.muted }}>{label}</Text>
    </View>
  );
}
