import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { activeThreadMessages, fmtTime, isBlocked, pendingIncomingFrom, threadMeta, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, FreeTag, PhotoTile, Screen, VerifiedBadge } from '@/pass/ui';

export default function Thread() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, sendMsg, sendImage, shareLoc, viewPerson, openListing, blockUser, unblockUser, showConfirm, acceptRequest, declineRequest } = usePass();
  const id = s.activeThreadId;
  const meta = id ? threadMeta(s, id) : null;
  const msgs = activeThreadMessages(s);
  const blocked = meta ? isBlocked(s, meta.otherId) : false;
  const incomingReq = meta ? pendingIncomingFrom(s, meta.otherId) : null;
  const reqListing = incomingReq ? s.listings.find((l) => l.id === incomingReq.listingId) : null;
  const locShared = msgs.some((m) => m.text.toLowerCase().includes('live location'));
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
    if (blocked) {
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
            <Avatar name={meta.otherName} size={40} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Pressable onPress={openPerson} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{meta.otherName}</Text>
              <VerifiedBadge size={14} />
            </Pressable>
          </View>
          <Pressable onPress={toggleBlock} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: blocked ? C.accent : C.line }}>
            <Icon name="shield" size={14} color={blocked ? C.accent : C.muted} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: blocked ? C.accent : C.muted }}>{blocked ? tr('thread.unblock') : tr('thread.block')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={openItem} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 8, marginTop: 11, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: meta.tint }} />
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
        {msgs.map((m) => {
          const mine = m.from === s.currentUserId;
          const url = m.text.match(/https?:\/\/\S+/)?.[0];
          const fg = mine ? '#fff' : C.ink;
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {m.image ? (
                <Image source={{ uri: m.image }} style={{ width: 200, height: 200, borderRadius: 18, backgroundColor: C.bg }} contentFit="cover" transition={150} />
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
              <Text style={{ fontSize: 10, color: C.muted, marginTop: 3, marginHorizontal: 4 }}>{fmtTime(m.ts)}</Text>
            </View>
          );
        })}
        {!locShared && !blocked && (
          <Btn icon="pin" label={tr('thread.shareLocation')} variant="accentOutline" onPress={shareLoc} style={{ alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14 }} textStyle={{ fontSize: 12.5 }} />
        )}
      </ScrollView>

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
            <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>{tr('thread.blockedNotice', { name: meta.otherName })}</Text>
            <Btn icon="shield" label={tr('thread.unblock')} variant="outline" onPress={() => unblockUser(meta.otherId)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable onPress={pickImage} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image" size={20} color={C.accent} />
            </Pressable>
            <TextInput
              value={s.draft}
              onChangeText={(draft) => patch({ draft })}
              placeholder={tr('thread.messagePlaceholder')}
              placeholderTextColor={C.muted}
              style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, fontSize: 13.5, color: C.ink }}
            />
            <Pressable onPress={sendMsg} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
