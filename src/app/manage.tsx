import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { catIcon, Icon, type IconName } from '@/pass/icon';
import { fmtAgo, fmtDate, myListings, requestsFor, userName, usePass, useT, userDp } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, EmptyState, Header, PhotoTile, Screen, shadow, t } from '@/pass/ui';
import type { Listing } from '@/pass/data';

export default function Manage() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, startPost, startEdit, openTakenPicker, confirmTaken, deleteListing, acceptRequest, declineRequest, openCancelReason, showConfirm, openListing, viewPerson } = usePass();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetListMax = Math.round(height * 0.5); // keep bottom-sheet usable on short devices
  const [tab, setTab] = useState<'live' | 'given'>('live');
  const [reqListId, setReqListId] = useState<string | null>(null);
  const list = myListings(s);
  const live = list.filter((l) => !l.taken);
  const given = list.filter((l) => l.taken);
  const shown = tab === 'live' ? live : given;

  const newListing = () => {
    startPost();
    router.push('/post');
  };
  const edit = (id: string) => {
    startEdit(id);
    router.push('/post');
  };
  const openItem = (id: string) => {
    openListing(id);
    router.push('/detail');
  };
  const openPerson = (id: typeof s.currentUserId) => {
    viewPerson(id);
    router.push('/giver');
  };
  const remove = (item: Listing) =>
    showConfirm({
      title: tr('manage.deleteListing'),
      message: tr('manage.deleteConfirm', { title: item.title }),
      confirmLabel: tr('common.delete'),
      destructive: true,
      onConfirm: () => deleteListing(item.id),
    });

  // only offer requesters who are still in play — never a declined/cancelled one
  const picker = s.takenPickerId ? requestsFor(s, s.takenPickerId).filter(({ request }) => request.status === 'pending' || request.status === 'accepted') : [];
  const sheetReqs = reqListId ? requestsFor(s, reqListId) : [];
  const reqItem = reqListId ? list.find((l) => l.id === reqListId) : null;

  return (
    <Screen>
      <Header title={tr('manage.title')} />

      {list.length === 0 ? (
        <EmptyState icon="gift" title={tr('manage.emptyTitle')} body={tr('manage.emptyBody')} ctaIcon="add" ctaLabel={tr('manage.postItem')} onCta={newListing} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Live / Given filter */}
          <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 4, gap: 4, marginBottom: 16 }}>
            {(['live', 'given'] as const).map((k) => {
              const on = tab === k;
              const n = k === 'live' ? live.length : given.length;
              return (
                <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : C.ink }}>
                    {k === 'live' ? tr('manage.tabLive') : tr('manage.tabGiven')} {n > 0 ? `· ${n}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {shown.length === 0 ? (
            <EmptyState
              compact
              icon={tab === 'live' ? 'gift' : 'check-circle'}
              title={tab === 'live' ? tr('manage.emptyLiveTitle') : tr('manage.emptyGivenTitle')}
              body={tab === 'live' ? tr('manage.emptyLiveBody') : tr('manage.emptyGivenBody')}
              ctaIcon={tab === 'live' ? 'add' : undefined}
              ctaLabel={tab === 'live' ? tr('manage.postItem') : undefined}
              onCta={tab === 'live' ? newListing : undefined}
            />
          ) : null}

          <View style={{ gap: 16 }}>
            {shown.map((item) => {
              const reqs = requestsFor(s, item.id);
              const pending = reqs.filter((r) => r.request.status === 'pending').length;
              return (
              <View key={item.id} style={{ backgroundColor: C.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16, ...shadow(10, 26, 0.4) }}>
                {/* header */}
                <Pressable onPress={() => openItem(item.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: 13, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                  <PhotoTile tint={item.tint} uri={item.photos?.[0]} icon={catIcon(item.cat)} iconSize={24} style={{ width: 58, height: 58, borderRadius: 15 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 3 }} numberOfLines={1}>{tr('cat.' + item.cat)} · {tr('cond.' + item.cond)}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }} numberOfLines={1}>{tr('manage.posted', { date: fmtDate(item.createdAt) })}</Text>
                  </View>
                  <View style={{ backgroundColor: item.taken ? C.bg : '#E4F0E9', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.taken ? C.muted : C.free }} numberOfLines={1}>
                      {item.taken ? tr('manage.badgeGiven') : tr('manage.badgeLive')}
                    </Text>
                  </View>
                </Pressable>

                {item.taken ? (
                  /* given banner — circular check + recipient + round delete (matches Saved) */
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 13, backgroundColor: '#E8F3EC', borderRadius: radius.lg, borderCurve: 'continuous', paddingVertical: 10, paddingHorizontal: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.free, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={19} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.free }} numberOfLines={1}>{tr('manage.givenTo', { name: item.takenBy ? userName(s, item.takenBy) : tr('manage.someone') })}</Text>
                      <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{tr('manage.deleteHint')}</Text>
                    </View>
                    <Pressable onPress={() => remove(item)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(46,125,50,0.25)', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="trash" size={16} color={C.muted} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {/* requests — compact pill opening the sheet */}
                    {reqs.length > 0 ? (
                      <Pressable
                        onPress={() => setReqListId(item.id)}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: pending > 0 ? C.accentSoft : C.bg, opacity: pressed ? 0.8 : 1 })}>
                        <Icon name="person" size={14} color={pending > 0 ? C.accent : C.muted} />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: pending > 0 ? C.accent : C.muted }}>
                          {pending > 0 ? tr('manage.newRequests', { n: pending }) : tr('manage.requestsCount', { n: reqs.length })}
                        </Text>
                        <Icon name="forward" size={15} color={pending > 0 ? C.accent : C.muted} />
                      </Pressable>
                    ) : null}

                    {/* actions — segmented footer */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 4 }}>
                      <ActionBtn icon="pencil" label={tr('common.edit')} color={C.ink} onPress={() => edit(item.id)} />
                      <View style={{ width: 1, height: 26, backgroundColor: C.line }} />
                      <ActionBtn icon="check" label={tr('manage.markTakenShort')} color={C.accent} onPress={() => openTakenPicker(item.id)} />
                      <View style={{ width: 1, height: 26, backgroundColor: C.line }} />
                      <ActionBtn icon="trash" label={tr('common.delete')} color={C.dangerInk} onPress={() => remove(item)} />
                    </View>
                  </>
                )}
              </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* taken picker — in-screen overlay so the rounded corners sit on the dim layer
          and the sheet fills through the bottom gesture area */}
      {s.takenPickerId !== null ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable onPress={() => patch({ takenPickerId: null })} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.45)' }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous', padding: 22, paddingTop: 8, paddingBottom: insets.bottom + 22 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={t.h3}>{tr('manage.whoPicked')}</Text>

            {picker.length === 0 ? (
              <Text style={[t.small, { marginTop: 14 }]}>{tr('manage.noRequestsYet')}</Text>
            ) : (
              <ScrollView style={{ maxHeight: sheetListMax, marginTop: 16 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
                {picker.map(({ request, user }) => (
                  <View key={request.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 12 }}>
                    <Avatar name={user.name} uri={userDp(s, request.fromUserId)} size={42} color={C.ink} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{user.name}</Text>
                      <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 18 }}>{request.note}</Text>
                      <Text style={{ fontSize: 11, color: C.accent, fontWeight: '700', marginTop: 4 }}>{tr('manage.requestedLine', { ago: fmtAgo(request.createdAt), date: fmtDate(request.createdAt) })}</Text>
                    </View>
                    <Btn label={tr('manage.choose')} onPress={() => confirmTaken(s.takenPickerId!, request.fromUserId)} style={{ paddingVertical: 9, paddingHorizontal: 16 }} textStyle={{ fontSize: 12.5 }} />
                  </View>
                ))}
              </ScrollView>
            )}

            <Btn label={tr('common.cancel')} variant="ghost" onPress={() => patch({ takenPickerId: null })} block style={{ marginTop: 18 }} />
          </View>
        </View>
      ) : null}

      {/* requests sheet — every requester for one listing; scrolls to any count */}
      {reqListId !== null ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable onPress={() => setReqListId(null)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.45)' }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous', padding: 22, paddingTop: 8, paddingBottom: insets.bottom + 18 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={t.h3} numberOfLines={1}>{tr('manage.requestsFor', { title: reqItem?.title ?? '' })}</Text>
            <ScrollView style={{ maxHeight: sheetListMax, marginTop: 14 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
              {sheetReqs.map(({ request, user }) => (
                <View key={request.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 15, borderCurve: 'continuous', padding: 12, gap: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => { setReqListId(null); openPerson(request.fromUserId); }} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, opacity: pressed ? 0.7 : 1 })}>
                      <Avatar name={user.name} uri={userDp(s, request.fromUserId)} size={40} color={C.ink} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }} numberOfLines={1}>{user.name}</Text>
                        <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }} numberOfLines={2}>{request.note}</Text>
                        <Text style={{ fontSize: 11, color: C.accent, fontWeight: '700', marginTop: 4 }}>{tr('manage.requestedLine', { ago: fmtAgo(request.createdAt), date: fmtDate(request.createdAt) })}</Text>
                      </View>
                    </Pressable>
                    {/* declined/cancelled: compact status chip inline on the right — no extra row, no taller card */}
                    {request.status !== 'pending' && request.status !== 'accepted' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.dangerBg, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 }}>
                        <Icon name="close-circle" size={13} color={C.dangerInk} />
                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.dangerInk }}>{tr('manage.declined')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {request.status === 'pending' ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Btn label={tr('inbox.reject')} variant="outline" onPress={() => declineRequest(request.id)} style={{ flex: 1, paddingVertical: 10, borderColor: C.dangerBorder }} textStyle={{ fontSize: 13.5, color: C.dangerInk }} />
                      <Btn icon="check" label={tr('common.accept')} onPress={() => acceptRequest(request.id)} style={{ flex: 1, paddingVertical: 10 }} textStyle={{ fontSize: 13.5 }} />
                    </View>
                  ) : request.status === 'accepted' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="check-circle" size={15} color={C.free} />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.free }}>{tr('manage.accepted')}</Text>
                      </View>
                      <Btn label={tr('common.cancel')} variant="outline" onPress={() => openCancelReason(request.id, 'owner')} style={{ paddingVertical: 9, paddingHorizontal: 16, borderColor: C.dangerBorder }} textStyle={{ fontSize: 13, color: C.dangerInk }} />
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <Btn label={tr('common.close')} variant="ghost" onPress={() => setReqListId(null)} block style={{ marginTop: 16 }} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 9, opacity: pressed ? 0.5 : 1 })}>
      <Icon name={icon} size={19} color={color} />
      <Text style={{ fontSize: 11.5, fontWeight: '700', color }}>{label}</Text>
    </Pressable>
  );
}
