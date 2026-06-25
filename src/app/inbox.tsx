import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/pass/icon';
import { fmtAgo, inboxRows, incomingRequests, threadId, threadPendingForMe, usePass, useT, userDp } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, BottomNav, Btn, EmptyState, PhotoTile, Screen, shadow, t } from '@/pass/ui';

export default function Inbox() {
  const router = useRouter();
  const tr = useT();
  const { s, openThread, viewPerson, acceptRequest, declineRequest, acceptThread, blockUser, openThreadFor, openListing, deleteThread, showConfirm } = usePass();
  const [tab, setTab] = useState<'chats' | 'requests'>('chats');
  const rows = inboxRows(s);
  // Requests tab = pending requests awaiting MY decision. A request stays here even
  // if the requester also messaged me (their messages show in Chats too) — it only
  // leaves once I accept it or start replying. (Before, any thread — including one
  // the requester created by messaging — wrongly hid the request from this tab.)
  const requests = incomingRequests(s).filter((r) => {
    if (r.request.status !== 'pending') return false;
    const tid = threadId(s.currentUserId, r.request.fromUserId);
    const iReplied = (s.threads[tid] ?? []).some((m) => m.from === s.currentUserId);
    return !s.threadAccepted[tid] && !iReplied;
  });
  const pending = requests.length;

  const openChatThread = (id: string) => {
    openThread(id);
    router.push('/thread');
  };
  const openItem = (id: string) => {
    openListing(id);
    router.push('/detail');
  };
  const openPerson = (id: typeof s.currentUserId) => {
    viewPerson(id);
    router.push('/giver');
  };
  const chatWith = (listingId: string) => {
    openThreadFor(listingId);
    router.push('/thread');
  };
  const confirmDelete = (rowId: string, name: string) => {
    showConfirm({
      title: tr('inbox.deleteChatTitle'),
      message: tr('inbox.deleteChatMsg', { name }),
      confirmLabel: tr('common.delete'),
      destructive: true,
      onConfirm: () => deleteThread(rowId),
    });
  };
  const confirmBlock = (id: typeof s.currentUserId, name: string) => {
    showConfirm({
      title: tr('thread.blockTitle', { name }),
      message: tr('thread.blockMsg'),
      confirmLabel: tr('thread.block'),
      destructive: true,
      onConfirm: () => blockUser(id),
    });
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
        <Text style={[t.h2, { marginBottom: 12 }]}>{tr('inbox.title')}</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 4, gap: 4 }}>
          {(['chats', 'requests'] as const).map((k) => {
            const on = tab === k;
            const badge = k === 'chats' ? rows.filter((r) => r.unread).length : pending;
            return (
              <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#fff' : C.ink }}>
                  {k === 'chats' ? tr('inbox.tabChats') : tr('inbox.tabRequests')} {badge > 0 ? `· ${badge}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24, gap: 11, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {tab === 'chats' ? (
          rows.length === 0 ? (
            <Empty icon="chat" title={tr('inbox.noChatsTitle')} body={tr('inbox.noChatsBody')} />
          ) : (
            rows.map((row) => (
              <ReanimatedSwipeable
                key={row.id}
                renderRightActions={() => (
                  <Pressable
                    onPress={() => confirmDelete(row.id, row.otherName)}
                    style={{ width: 78, marginLeft: 8, backgroundColor: C.dangerBg, borderRadius: radius.lg, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={22} color={C.dangerInk} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.dangerInk, marginTop: 4 }}>{tr('common.delete')}</Text>
                  </Pressable>
                )}>
                <Pressable onPress={() => openChatThread(row.id)} style={{ backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 12, ...shadow(8, 20, 0.4) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <Avatar name={row.otherName} uri={userDp(s, row.otherId)} size={54} square />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: row.unread ? '800' : '700', color: C.ink, flexShrink: 1 }}>{row.otherName}</Text>
                          {threadPendingForMe(s, row.id) ? (
                            <View style={{ backgroundColor: C.accentSoft, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: C.accent }}>{tr('inbox.pendingBadge')}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ fontSize: 11, color: row.unread ? C.accent : C.muted, fontWeight: row.unread ? '700' : '400' }}>{row.time}</Text>
                      </View>
                      {row.item ? <Text style={{ fontSize: 11.5, color: C.accent, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{row.item}</Text> : null}
                      <Text style={{ fontSize: 12.5, color: row.unread ? C.ink : C.muted, fontWeight: row.unread ? '600' : '400', marginTop: 3 }} numberOfLines={1}>{row.last}</Text>
                    </View>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: row.unread ? C.accent : 'transparent' }} />
                  </View>
                  {/* new-contact gate: accept / delete / block right here in the list */}
                  {threadPendingForMe(s, row.id) ? (
                    <View style={{ flexDirection: 'row', gap: 7, marginTop: 11 }}>
                      <Btn icon="check" label={tr('common.accept')} onPress={() => acceptThread(row.id)} style={{ flex: 1, paddingVertical: 8 }} textStyle={{ fontSize: 12 }} />
                      <Btn label={tr('common.delete')} variant="outline" onPress={() => confirmDelete(row.id, row.otherName)} style={{ flex: 1, paddingVertical: 8 }} textStyle={{ fontSize: 12 }} />
                      <Btn label={tr('thread.block')} variant="outline" onPress={() => confirmBlock(row.otherId, row.otherName)} style={{ flex: 1, paddingVertical: 8, borderColor: C.dangerBorder }} textStyle={{ fontSize: 12, color: C.dangerInk }} />
                    </View>
                  ) : null}
                </Pressable>
              </ReanimatedSwipeable>
            ))
          )
        ) : requests.length === 0 ? (
          <Empty icon="clipboard" title={tr('inbox.noRequestsTitle')} body={tr('inbox.noRequestsBody')} />
        ) : (
          requests.map(({ request, user, listing }) => (
            <View key={request.id} style={{ backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: 13, gap: 11, ...shadow(8, 20, 0.4) }}>
              {/* requester + time */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Pressable onPress={() => openPerson(request.fromUserId)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, opacity: pressed ? 0.7 : 1 })}>
                  <Avatar name={user.name} uri={userDp(s, request.fromUserId)} size={42} color={C.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }} numberOfLines={1}>{user.name}</Text>
                    <Text style={{ fontSize: 11.5, color: C.muted }}>{tr('inbox.requested')} · {fmtAgo(request.createdAt)}</Text>
                  </View>
                </Pressable>
                {request.status !== 'pending' ? (
                  <View style={{ backgroundColor: request.status === 'accepted' ? '#E4F0E9' : C.bg, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: request.status === 'accepted' ? C.free : C.muted }}>{request.status === 'accepted' ? tr('inbox.accepted') : tr('inbox.declined')}</Text>
                  </View>
                ) : null}
              </View>

              {/* listing + message */}
              <Pressable onPress={() => listing && openItem(listing.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.bg, borderRadius: radius.md, padding: 10 }}>
                <PhotoTile tint={listing?.tint ?? C.bg} uri={listing?.photos?.[0]} gap={10} style={{ width: 44, height: 44, borderRadius: 11 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.ink }} numberOfLines={1}>{listing ? listing.title : tr('inbox.listingRemoved')}</Text>
                  <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }} numberOfLines={2}>{request.note}</Text>
                </View>
              </Pressable>

              {/* actions */}
              {request.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn label={tr('inbox.reject')} variant="outline" onPress={() => declineRequest(request.id)} style={{ flex: 1, paddingVertical: 11, borderColor: C.dangerBorder }} textStyle={{ fontSize: 14, color: C.dangerInk }} />
                  <Btn icon="check" label={tr('common.accept')} onPress={() => acceptRequest(request.id)} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 14 }} />
                </View>
              ) : request.status === 'accepted' && listing ? (
                <Btn icon="chat" label={tr('inbox.chatWith', { name: user.name })} onPress={() => chatWith(listing.id)} block style={{ paddingVertical: 11 }} textStyle={{ fontSize: 14 }} />
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      <BottomNav active="inbox" />
    </Screen>
  );
}

function Empty({ icon, title, body }: { icon: 'chat' | 'clipboard'; title: string; body: string }) {
  return <EmptyState icon={icon} title={title} body={body} />;
}
