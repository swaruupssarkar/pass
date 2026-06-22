import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CITIES, USERS } from '@/pass/data';
import { catIcon, Icon } from '@/pass/icon';
import { distLabel, fmtAgo, fmtDate, otherOf, reviewsFor, userName, userRating, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, FreeTag, Header, PhotoTile, Screen, shadow, t, VerifiedBadge } from '@/pass/ui';

export default function Giver() {
  const router = useRouter();
  const tr = useT();
  const { s, openListing, openThreadFor, toggleSave, viewPerson } = usePass();

  const id = s.activePersonId ?? otherOf(s.currentUserId).id;
  const person = USERS[id];
  const name = userName(s, id);
  const rating = userRating(s, id);
  // show the city this user is actually browsing from (their chosen city), not just their home
  const city = CITIES.find((c) => c.id === (s.userCity?.[id] ?? person.cityId));

  const live = s.listings.filter((l) => l.ownerId === id && !l.taken);
  const given = s.listings.filter((l) => l.ownerId === id && l.taken).length;
  const received = s.listings.filter((l) => l.takenBy === id).length;
  const reviews = reviewsFor(s, id);
  const [reviewLimit, setReviewLimit] = useState(5);

  const open = (lid: string) => {
    openListing(lid);
    router.push('/detail');
  };
  const openPerson = (pid: typeof id) => {
    viewPerson(pid);
    router.push('/giver');
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
          <View style={{ backgroundColor: C.surface, borderRadius: 24, borderCurve: 'continuous', padding: 20, ...shadow(12, 30, 0.35) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <Avatar name={name} uri={s.dp[id]} size={68} square />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 }} numberOfLines={1}>{name}</Text>
                  <VerifiedBadge size={18} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Icon name="star" size={13} color={C.star} />
                  <Text style={{ fontSize: 12.5, color: C.ink, fontWeight: '700' }}>{rating != null ? rating : tr('common.new')}</Text>
                  {reviews.length > 0 ? <Text style={{ fontSize: 12.5, color: C.muted }}>· {tr('common.reviewsN', { n: reviews.length })}</Text> : null}
                  <Text style={{ fontSize: 12.5, color: C.muted }}>· {tr('giver.memberSince', { year: person.since })}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Icon name="pin" size={12.5} color={C.accent} />
                  <Text style={{ fontSize: 12.5, color: C.muted }}>{city?.name}</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}>
              <Stat n={live.length} label={tr('giver.liveListings')} />
              <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
              <Stat n={given} label={tr('giver.given')} />
              <View style={{ width: 1, backgroundColor: C.line, marginVertical: 2 }} />
              <Stat n={received} label={tr('profile.received')} />
            </View>

            <Btn icon="chat" label={tr('giver.message', { name })} onPress={message} block style={{ marginTop: 18, paddingVertical: 14 }} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[t.h3, { fontSize: 17 }]}>{tr('giver.giveaways', { name })}</Text>
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
              <PhotoTile tint={l.tint} uri={l.photos?.[0]} icon={catIcon(l.cat)} iconSize={42} gap={18} style={{ aspectRatio: 1, borderRadius: 13 }}>
                {distLabel(s, l) ? (
                  <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(28,24,22,0.6)', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{distLabel(s, l)}</Text>
                  </View>
                ) : null}
                <Pressable onPress={() => toggleSave(l.id)} hitSlop={6} style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px -3px rgba(0,0,0,0.3)' }}>
                  <Icon name={s.saved[l.id] ? 'heart' : 'heart-outline'} size={15} color={C.accent} />
                </Pressable>
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
            <>
            {reviews.slice(0, reviewLimit).map((r) => (
              <View key={r.id} style={{ backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 15, ...shadow(8, 20, 0.35) }}>
                {/* reviewer — tap to open their profile */}
                <Pressable onPress={() => openPerson(r.from)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, opacity: pressed ? 0.7 : 1 })}>
                  <Avatar name={userName(s, r.from)} uri={s.dp[r.from]} size={40} color={C.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }} numberOfLines={1}>{userName(s, r.from)}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 3 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={13} color={C.star} />
                      ))}
                    </View>
                  </View>
                  <Icon name="forward" size={18} color={C.muted} />
                </Pressable>

                {/* what they said — tags as chips */}
                {r.tags.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {r.tags.map((tag) => (
                      <View key={tag} style={{ backgroundColor: C.accentSoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 11 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.accent }}>{tr('rate.tag.' + tag)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {r.text ? <Text style={{ fontSize: 14, color: C.ink, lineHeight: 20, marginTop: r.tags.length > 0 ? 10 : 12 }}>{r.text}</Text> : null}

                {/* when */}
                <Text style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>{fmtDate(r.ts)} · {fmtAgo(r.ts)}</Text>
              </View>
            ))}
            {reviews.length > reviewLimit ? (
              <Btn
                icon="down"
                label={tr('common.loadMore', { n: reviews.length - reviewLimit })}
                variant="outline"
                onPress={() => setReviewLimit((n) => n + 5)}
                block
                style={{ marginTop: 2, paddingVertical: 12 }}
                textStyle={{ fontSize: 14 }}
              />
            ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 23, fontWeight: '800', color: C.ink }}>{n}</Text>
      <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center' }} numberOfLines={2}>{label}</Text>
    </View>
  );
}
