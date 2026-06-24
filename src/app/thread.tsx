import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Fragment, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { catIcon, Icon } from '@/pass/icon';
import { activeThreadMessages, chatDay, dayStamp, fmtTime, iBlocked, isBlocked, listingById, pendingIncomingFrom, pendingReviewFrom, threadMeta, threadPendingForMe, usePass, useT, userDp } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, FreeTag, PhotoTile, Screen, VerifiedBadge } from '@/pass/ui';

export default function Thread() {
  const router = useRouter();
  const tr = useT();
  const { width } = useWindowDimensions();
  const chatImg = Math.min(220, Math.round(width * 0.62)); // fits the 80%-max bubble on any width
  const { s, sendMsg, sendImage, shareLoc, viewPerson, openListing, blockUser, unblockUser, showConfirm, acceptRequest, declineRequest, acceptThread, deleteThread, markThreadRead, startRateForListing } = usePass();
  const [draft, setDraft] = useState('');
  const send = () => {
    sendMsg(draft);
    setDraft('');
  };
  const id = s.activeThreadId;
  const meta = id ? threadMeta(s, id) : null;
  const msgs = activeThreadMessages(s);
  const blocked = meta ? isBlocked(s, meta.otherId) : false;
  const iBlk = meta ? iBlocked(s, meta.otherId) : false; // I'm the blocker (can unblock)
  const incomingReq = meta ? pendingIncomingFrom(s, meta.otherId) : null;
  const reqListing = incomingReq ? s.listings.find((l) => l.id === incomingReq.listingId) : null;
  // I've already shared a real location pin (not just any message mentioning the phrase)
  const locShared = msgs.some((m) => m.from === s.currentUserId && /maps\.google\.com\/\?q=/.test(m.text));
  const openItem = () => {
    if (meta?.listingId) {
      openListing(meta.listingId);
      router.push('/detail');
    }
  };
  const scrollRef = useRef<ScrollView>(null);

  // keep the latest message in view as the conversation grows
  useEffect(() => {
    const tid = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(tid);
  }, [msgs.length]);

  // viewing the thread marks it read for the current user (drives the other side's ticks)
  useEffect(() => {
    if (id) markThreadRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, msgs.length]);

  if (!meta) {
    return (
      <Screen edges={['top', 'bottom']} bg={C.bg}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
          <Text style={{ fontSize: 15, color: C.muted, textAlign: 'center' }}>{tr('thread.unavailable')}</Text>
          <Btn icon="back" label={tr('common.back')} variant="outline" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const openPerson = () => {
    viewPerson(meta.otherId);
    router.push('/giver');
  };
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) sendImage(res.assets[0].uri);
  };
  const toggleBlock = () => {
    if (iBlk) {
      unblockUser(meta.otherId);
      return;
    }
    showConfirm({
      title: tr('thread.blockTitle', { name: meta.otherName }),
      message: tr('thread.blockMsg'),
      confirmLabel: tr('thread.block'),
      destructive: true,
      onConfirm: () => blockUser(meta.otherId),
    });
  };
  // cold DM the current user hasn't accepted yet -> show accept/delete/block instead of a reply box
  const pendingChat = !incomingReq && msgs.length > 0 && threadPendingForMe(s, meta.id);
  // my messages are "read" once the other person viewed the thread after they were sent
  const otherLastRead = s.threadRead[meta.id]?.[meta.otherId] ?? 0;
  const headerListing = meta.listingId ? listingById(s, meta.listingId) : null;
  // an item this person handed me that I haven't reviewed yet -> show an in-chat rate prompt
  const reviewListing = blocked ? null : pendingReviewFrom(s, meta.otherId);
  const rate = (n: number) => {
    if (!reviewListing) return;
    startRateForListing(reviewListing.id, n);
    router.push('/rate');
  };
  const confirmDeleteConv = () => {
    showConfirm({
      title: tr('inbox.deleteChatTitle'),
      message: tr('inbox.deleteChatMsg', { name: meta.otherName }),
      confirmLabel: tr('common.delete'),
      destructive: true,
      onConfirm: () => {
        deleteThread(meta.id);
        router.back();
      },
    });
  };

  return (
    <Screen edges={['top', 'bottom']} bg={C.bg}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* header */}
      <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Icon name="back" size={22} color={C.ink} />
          </Pressable>
          <Pressable onPress={openPerson}>
            <Avatar name={meta.otherName} uri={userDp(s, meta.otherId)} size={40} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Pressable onPress={openPerson} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{meta.otherName}</Text>
              <VerifiedBadge size={14} />
            </Pressable>
          </View>
          {!blocked || iBlk ? (
            <Pressable onPress={toggleBlock} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: iBlk ? C.accent : C.line }}>
              <Icon name="shield" size={14} color={iBlk ? C.accent : C.muted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: iBlk ? C.accent : C.muted }}>{iBlk ? tr('thread.unblock') : tr('thread.block')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={openItem} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 8, marginTop: 11, opacity: pressed ? 0.7 : 1 })}>
          <PhotoTile tint={meta.tint} uri={headerListing?.photos?.[0]} icon={headerListing ? catIcon(headerListing.cat) : undefined} iconSize={18} style={{ width: 38, height: 38, borderRadius: 9 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }} numberOfLines={1}>{meta.item}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="pin" size={11} color={C.muted} />
              <Text style={{ fontSize: 11, color: C.muted }}>{meta.area}</Text>
            </View>
          </View>
          <FreeTag small />
          <Icon name="forward" size={18} color={C.muted} />
        </Pressable>
      </View>

      {/* safety strip */}
      <View style={{ backgroundColor: C.warnBg, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: C.warnBorder }}>
        <Icon name="warning" size={12} color={C.warnInk} />
        <Text style={{ fontSize: 11.5, color: C.warnInk, fontWeight: '600' }}>{tr('thread.safety')}</Text>
      </View>

      {/* messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {msgs.map((m, i) => {
          const mine = m.from === s.currentUserId;
          const url = m.text.match(/https?:\/\/\S+/)?.[0];
          const fg = mine ? '#fff' : C.ink;
          const prev = msgs[i - 1];
          const showDay = !prev || dayStamp(prev.ts) !== dayStamp(m.ts);
          const day = showDay ? chatDay(m.ts) : null;
          const dayLbl = day ? (day.today ? tr('common.today') : day.yesterday ? tr('common.yesterday') : day.date) : '';
          const read = mine && otherLastRead >= m.ts;
          return (
            <Fragment key={m.id}>
            {showDay ? (
              <View style={{ alignItems: 'center', marginVertical: 2 }}>
                <View style={{ backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 12, boxShadow: '0 2px 6px -4px rgba(0,0,0,0.3)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>{dayLbl}</Text>
                </View>
              </View>
            ) : null}
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {m.image ? (
                <Image source={{ uri: m.image }} style={{ width: chatImg, height: chatImg, borderRadius: 18, backgroundColor: C.bg }} contentFit="cover" transition={150} />
              ) : (
                <Pressable
                  disabled={!url}
                  onPress={() => url && Linking.openURL(url)}
                  style={{
                    backgroundColor: mine ? C.accent : C.surface,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 5 : 18,
                    borderBottomLeftRadius: mine ? 18 : 5,
                    boxShadow: mine ? undefined : '0 4px 12px -8px rgba(0,0,0,0.3)',
                  }}>
                  {url ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Icon name="pin" size={15} color={fg} />
                      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: fg, textDecorationLine: 'underline' }}>{tr('thread.openLiveLocation')}</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, lineHeight: 20, color: fg }}>{m.text}</Text>
                  )}
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, marginHorizontal: 4 }}>
                <Text style={{ fontSize: 10, color: C.muted }}>{fmtTime(m.ts)}</Text>
                {mine ? <Icon name={read ? 'tickRead' : 'tickSent'} size={13} color={read ? '#34B7F1' : C.muted} /> : null}
              </View>
            </View>
            </Fragment>
          );
        })}
        {!locShared && !blocked && !pendingChat && (
          <Btn icon="pin" label={tr('thread.shareLocation')} variant="accentOutline" onPress={shareLoc} style={{ alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14 }} textStyle={{ fontSize: 12.5 }} />
        )}
      </ScrollView>

      {/* in-chat rate prompt — recipient rates the giver for the item handed over */}
      {reviewListing ? (
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, gap: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{tr('thread.ratePrompt', { name: meta.otherName, title: reviewListing.title })}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => rate(n)} hitSlop={4}>
                <Icon name="star-outline" size={32} color={C.star} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* incoming request: product + accept / reject inline */}
      {incomingReq && !blocked ? (
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 10 }}>
          <Text style={{ fontSize: 12.5, color: C.muted }}>
            <Text style={{ fontWeight: '800', color: C.ink }}>{meta.otherName}</Text> {tr('thread.requestedThisItem')}
          </Text>
          <Pressable
            onPress={() => {
              if (reqListing) {
                openListing(reqListing.id);
                router.push('/detail');
              }
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.bg, borderRadius: radius.md, padding: 9, opacity: pressed ? 0.7 : 1 })}>
            <PhotoTile tint={reqListing?.tint ?? meta.tint} uri={reqListing?.photos?.[0]} gap={10} style={{ width: 46, height: 46, borderRadius: 11 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }} numberOfLines={1}>{reqListing?.title ?? meta.item}</Text>
              <Text style={{ fontSize: 11.5, color: C.accent, fontWeight: '700' }}>{tr('thread.viewProduct')}</Text>
            </View>
            <Icon name="forward" size={18} color={C.muted} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label={tr('thread.reject')} variant="outline" onPress={() => declineRequest(incomingReq.id)} style={{ flex: 1, paddingVertical: 10, borderColor: C.dangerBorder }} textStyle={{ fontSize: 14, color: C.dangerInk }} />
            <Btn icon="check" label={tr('common.accept')} onPress={() => acceptRequest(incomingReq.id)} style={{ flex: 1, paddingVertical: 10 }} textStyle={{ fontSize: 14 }} />
          </View>
        </View>
      ) : null}

      {/* composer */}
      <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 }}>
        {blocked ? (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>
              {iBlk ? tr('thread.blockedNotice', { name: meta.otherName }) : tr('thread.blockedByOther', { name: meta.otherName })}
            </Text>
            {iBlk ? <Btn icon="shield" label={tr('thread.unblock')} variant="outline" onPress={() => unblockUser(meta.otherId)} /> : null}
          </View>
        ) : pendingChat ? (
          <View style={{ gap: 10, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="chat" size={16} color={C.accent} />
              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '800', color: C.ink }}>{tr('thread.pendingTitle', { name: meta.otherName })}</Text>
            </View>
            <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 18 }}>{tr('thread.pendingMsg')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label={tr('thread.block')} variant="outline" onPress={toggleBlock} style={{ flex: 1, paddingVertical: 11, borderColor: C.dangerBorder }} textStyle={{ fontSize: 13, color: C.dangerInk }} />
              <Btn label={tr('common.delete')} variant="outline" onPress={confirmDeleteConv} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 13 }} />
              <Btn icon="check" label={tr('common.accept')} onPress={() => acceptThread(meta.id)} style={{ flex: 1, paddingVertical: 11 }} textStyle={{ fontSize: 13 }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable onPress={pickImage} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image" size={20} color={C.accent} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              placeholder={tr('thread.messagePlaceholder')}
              placeholderTextColor={C.muted}
              style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, fontSize: 13.5, color: C.ink }}
            />
            <Pressable onPress={send} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
