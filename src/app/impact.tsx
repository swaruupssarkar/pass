import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { catIcon, Icon } from '@/pass/icon';
import { fmtAgo, fmtDate, listingById, myHandoffs, reviewsFor, userName, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Header, PhotoTile, ReviewCard, Screen, shadow, t } from '@/pass/ui';

export default function Impact() {
  const router = useRouter();
  const tr = useT();
  const { s, viewPerson } = usePass();
  const openPerson = (id: typeof s.currentUserId) => {
    viewPerson(id);
    router.push('/giver');
  };
  const handoffs = myHandoffs(s);
  const n = handoffs.length;
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
            {handoffs.map((h) => {
              const name = userName(s, h.recipientId);
              return (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 13, ...shadow(8, 20, 0.35) }}>
                  <PhotoTile tint={h.tint} uri={h.photo} icon={catIcon(h.cat)} iconSize={20} style={{ width: 50, height: 50, borderRadius: 13 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: C.ink }} numberOfLines={1}>{h.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Avatar name={name} uri={s.dp[h.recipientId]} size={18} color={C.ink} />
                      <Text style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>{tr('manage.givenTo', { name })}</Text>
                    </View>
                  </View>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#E4F0E9', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={16} color={C.free} />
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
              <ReviewCard
                key={r.id}
                rating={r.rating}
                tags={r.tags}
                text={r.text}
                authorName={userName(s, r.from)}
                authorUri={s.dp[r.from]}
                date={`${fmtDate(r.ts)} · ${fmtAgo(r.ts)}`}
                product={listingById(s, r.listingId ?? null)?.title}
                onAuthorPress={() => openPerson(r.from)}
              />
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
