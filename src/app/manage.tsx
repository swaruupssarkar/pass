import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { fmtAgo, fmtDate, myListings, requestsFor, USERS, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, Header, PhotoTile, Screen, shadow, t } from '@/pass/ui';
import type { Listing } from '@/pass/data';

export default function Manage() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, startPost, startEdit, openTakenPicker, confirmTaken, deleteListing, acceptRequest, declineRequest, showConfirm, openListing, viewPerson } = usePass();
  const [tab, setTab] = useState<'live' | 'given'>('live');
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

  const picker = s.takenPickerId ? requestsFor(s, s.takenPickerId) : [];

  return (
    <Screen>
      <Header title={tr('manage.title')} />

      {list.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gift" size={32} color={C.accent} />
          </View>
          <Text style={[t.h3, { marginTop: 16 }]}>{tr('manage.emptyTitle')}</Text>
          <Text style={[t.small, { marginTop: 8, textAlign: 'center' }]}>{tr('manage.emptyBody')}</Text>
          <Btn icon="add" label={tr('manage.postItem')} onPress={newListing} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
        </View>
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
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tab === 'live' ? 'gift' : 'check-circle'} size={30} color={C.accent} />
              </View>
              <Text style={[t.h3, { marginTop: 16 }]}>{tab === 'live' ? tr('manage.emptyLiveTitle') : tr('manage.emptyGivenTitle')}</Text>
              <Text style={[t.small, { marginTop: 8, textAlign: 'center', maxWidth: 280 }]}>
                {tab === 'live' ? tr('manage.emptyLiveBody') : tr('manage.emptyGivenBody')}
              </Text>
              {tab === 'live' ? (
                <Btn icon="add" label={tr('manage.postItem')} onPress={newListing} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: 16 }}>
            {shown.map((item) => (
              <View key={item.id} style={{ backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 15, ...shadow(10, 26, 0.4) }}>
                <Pressable onPress={() => openItem(item.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
                  <PhotoTile tint={item.tint} uri={item.photos?.[0]} style={{ width: 52, height: 52, borderRadius: 13 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }} numberOfLines={1}>{tr('cat.' + item.cat)} · {tr('cond.' + item.cond)}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 3 }} numberOfLines={1}>{tr('manage.posted', { date: fmtDate(item.createdAt) })}</Text>
                    {item.updatedAt ? (
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }} numberOfLines={1}>{tr('manage.lastUpdated', { date: fmtDate(item.updatedAt) })}</Text>
                    ) : null}
                  </View>
                  <View style={{ backgroundColor: item.taken ? C.bg : '#E4F0E9', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.taken ? C.muted : C.free }} numberOfLines={1}>
                      {item.taken ? tr('manage.givenTo', { name: item.takenBy ? USERS[item.takenBy].name : tr('manage.someone') }) : tr('manage.badgeLive')}
                    </Text>
                  </View>
                </Pressable>

                {!item.taken && requestsFor(s, item.id).length > 0 ? (
                  <View style={{ marginTop: 14, gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.3 }}>{tr('manage.requests')}</Text>
                    {requestsFor(s, item.id).map(({ request, user }) => (
                      <View key={request.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10 }}>
                        <Pressable onPress={() => openPerson(request.fromUserId)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, opacity: pressed ? 0.7 : 1 })}>
                          <Avatar name={user.name} size={36} color={C.ink} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.ink }} numberOfLines={1}>{user.name}</Text>
                            <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{request.note}</Text>
                            <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{tr('manage.requestedLine', { ago: fmtAgo(request.createdAt), date: fmtDate(request.createdAt) })}</Text>
                          </View>
                        </Pressable>
                        {request.status === 'pending' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Pressable onPress={() => declineRequest(request.id)} style={{ width: 38, height: 38, borderRadius: radius.md, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="close" size={16} color={C.muted} />
                            </Pressable>
                            <Btn label={tr('common.accept')} onPress={() => acceptRequest(request.id)} style={{ paddingVertical: 9, paddingHorizontal: 16 }} textStyle={{ fontSize: 13 }} />
                          </View>
                        ) : (
                          <View style={{ backgroundColor: request.status === 'accepted' ? '#E4F0E9' : C.bg, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: request.status === 'accepted' ? C.free : C.muted }}>
                              {request.status === 'accepted' ? tr('manage.accepted') : tr('manage.declined')}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                {!item.taken ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Btn icon="pencil" label={tr('common.edit')} variant="outline" onPress={() => edit(item.id)} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 14 }} />
                    <Btn icon="check" label={tr('manage.markTaken')} onPress={() => openTakenPicker(item.id)} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 14 }} />
                    <Pressable onPress={() => remove(item)} style={{ width: 46, height: 46, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.dangerBorder, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="trash" size={18} color={C.dangerInk} />
                    </Pressable>
                  </View>
                ) : (
                  <Btn icon="trash" label={tr('manage.deleteListing')} variant="outline" onPress={() => remove(item)} block style={{ marginTop: 14, paddingVertical: 11, borderColor: C.dangerBorder }} textStyle={{ fontSize: 14, color: C.dangerInk }} />
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* taken picker */}
      <Modal visible={s.takenPickerId !== null} transparent animationType="slide" onRequestClose={() => patch({ takenPickerId: null })}>
        <Pressable onPress={() => patch({ takenPickerId: null })} style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.35)' }} />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingTop: 8 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={t.h3}>{tr('manage.whoPicked')}</Text>

          {picker.length === 0 ? (
            <Text style={[t.small, { marginTop: 14 }]}>{tr('manage.noRequestsYet')}</Text>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              {picker.map(({ request, user }) => (
                <View key={request.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 12 }}>
                  <Avatar name={user.name} size={42} color={C.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{user.name}</Text>
                    <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 18 }}>{request.note}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{tr('manage.requestedLine', { ago: fmtAgo(request.createdAt), date: fmtDate(request.createdAt) })}</Text>
                  </View>
                  <Btn label={tr('manage.choose')} onPress={() => confirmTaken(s.takenPickerId!, request.fromUserId)} style={{ paddingVertical: 9, paddingHorizontal: 16 }} textStyle={{ fontSize: 12.5 }} />
                </View>
              ))}
            </View>
          )}

          <Btn label={tr('common.cancel')} variant="ghost" onPress={() => patch({ takenPickerId: null })} block style={{ marginTop: 18 }} />
        </View>
      </Modal>
    </Screen>
  );
}
