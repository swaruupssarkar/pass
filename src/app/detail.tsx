import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/pass/icon';
import { activeListing, distLabel, myRequestFor, USERS, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, Hatch, Header, SafetyNote, Screen, VerifiedBadge, t } from '@/pass/ui';

export default function Detail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { s, patch, toggleSave, viewPerson, requestListing, openThreadFor, openTakenPicker, showAlert, cancelRequest, showConfirm } = usePass();
  const item = activeListing(s);

  if (!item) {
    return (
      <Screen>
        <Header title="Listing" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={32} color={C.accent} />
          </View>
          <Text style={[t.h3, { marginTop: 16 }]}>Listing not found</Text>
          <Btn label="Go back" onPress={() => router.back()} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
        </View>
      </Screen>
    );
  }

  const owner = USERS[item.ownerId];
  const mine = item.ownerId === s.currentUserId;
  const myReq = myRequestFor(s, item.id);
  const saved = !!s.saved[item.id];
  const photos = item.photos ?? [];
  const count = photos.length > 0 ? photos.length : 4;
  const gal = Math.min(s.galleryIdx, count - 1);
  const sheetTop = height * (s.sheetExpanded ? 0.07 : 0.46);

  const step = (dir: number) => patch({ galleryIdx: (gal + dir + count) % count });
  const viewGiver = () => {
    viewPerson(item.ownerId);
    router.push('/giver');
  };
  const wantThis = () => {
    requestListing(item.id, '');
    showAlert('Request sent', `We let ${owner.name} know. You can chat once they accept.`);
  };
  const messageGiver = () => {
    openThreadFor(item.id);
    router.push('/thread');
  };
  const markTaken = () => {
    openTakenPicker(item.id);
    router.push('/manage');
  };
  const cancel = () => {
    if (!myReq) return;
    showConfirm({
      title: 'Cancel request?',
      message: `Withdraw your request for “${item.title}”?`,
      confirmLabel: 'Cancel request',
      destructive: true,
      onConfirm: () => cancelRequest(myReq.id),
    });
  };

  // swipe up to expand the sheet, swipe down to collapse (tap still works too)
  const sheetPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationY < -40) patch({ sheetExpanded: true });
      else if (e.translationY > 40) patch({ sheetExpanded: false });
    });

  return (
    <View style={{ flex: 1, backgroundColor: item.tint }}>
      <StatusBar style="dark" />
      {/* gallery */}
      <View style={{ flex: 1 }}>
        {photos.length > 0 ? (
          <Image source={{ uri: photos[gal] }} style={StyleAbs} contentFit="cover" transition={150} />
        ) : (
          <>
            <Hatch gap={32} />
            <View style={StyleAbs}>
              <Text style={{ flex: 1, textAlign: 'center', textAlignVertical: 'center', fontFamily: 'monospace', fontSize: 13, color: C.ink, opacity: 0.42 }}>
                {item.ph} {gal + 1}
              </Text>
            </View>
          </>
        )}
        {/* tap zones */}
        <Pressable onPress={() => step(-1)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%' }} />
        <Pressable onPress={() => step(1)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%' }} />

        <Pressable onPress={() => router.back()} style={[galBtn, { top: insets.top + 6, left: 16 }]}>
          <Icon name="back" size={22} color={C.ink} />
        </Pressable>
        <View style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(28,24,22,0.6)', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{gal + 1} / {count}</Text>
          </View>
        </View>
        <Pressable onPress={() => toggleSave(item.id)} style={[galBtn, { top: insets.top + 6, right: 16 }]}>
          <Icon name={saved ? 'heart' : 'heart-outline'} size={20} color={C.accent} />
        </Pressable>
        <View style={{ position: 'absolute', top: '36%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={{ width: i === gal ? 22 : 7, height: 6, borderRadius: 3, backgroundColor: i === gal ? '#fff' : 'rgba(255,255,255,0.55)' }} />
          ))}
        </View>
      </View>

      {/* bottom sheet */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetTop, backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', boxShadow: '0 -14px 40px -16px rgba(0,0,0,0.3)' }}>
        <GestureDetector gesture={sheetPan}>
          <Pressable onPress={() => patch({ sheetExpanded: !s.sheetExpanded })} style={{ alignItems: 'center', gap: 5, paddingTop: 11, paddingBottom: 6 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>{s.sheetExpanded ? 'Show less · swipe down' : 'Show more · swipe up'}</Text>
          </Pressable>
        </GestureDetector>

        <ScrollView scrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 25, fontWeight: '800', color: C.ink, letterSpacing: -0.6, lineHeight: 29 }}>{item.title}</Text>
            <View style={{ backgroundColor: C.free, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.4 }}>FREE</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 }}>
            <Icon name="pin" size={15} color={C.muted} />
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.muted }}>{distLabel(s, item)} · {item.area}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
            <Chip text={item.cat} accent />
            <Chip text={`Condition · ${item.cond}`} />
            <Chip text={`Pickup · ${item.area}`} />
          </View>

          <Pressable onPress={mine ? undefined : viewGiver} style={{ marginTop: 16, backgroundColor: C.bg, borderRadius: radius.lg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <Avatar name={owner.name} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{owner.name}</Text>
                <VerifiedBadge />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Icon name="star" size={12.5} color={C.star} />
                <Text style={{ fontSize: 12.5, color: C.muted }}>{owner.rating} · Member since {owner.since}</Text>
              </View>
            </View>
            {!mine && <Text style={{ color: C.accent, fontSize: 14, fontWeight: '800' }}>View</Text>}
          </Pressable>

          <Text style={{ fontSize: 14.5, color: C.ink, opacity: 0.82, lineHeight: 23, marginTop: 16 }}>{item.desc}</Text>

          {item.taken ? (
            <View style={{ marginTop: 18, backgroundColor: C.bg, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="check-circle" size={18} color={C.muted} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.muted }}>This item has been taken</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 18 }}>
            <SafetyNote text="This item is free. Never pay, never scan a QR code, never share an OTP to claim it." />
          </View>
          <Pressable onPress={() => router.push('/report')} style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.muted }}>Report this listing</Text>
          </Pressable>
        </ScrollView>

        {!item.taken ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: C.line }}>
            {mine ? (
              <Btn icon="check" label="Mark as Taken" onPress={markTaken} style={{ flex: 1 }} />
            ) : !myReq ? (
              <Btn label="I want this" onPress={wantThis} style={{ flex: 1 }} />
            ) : myReq.status === 'pending' ? (
              <>
                <Btn icon="time" label="Requested" onPress={undefined} style={{ flex: 1, opacity: 0.55 }} variant="outline" textStyle={{ color: C.muted }} />
                <Btn label="Cancel" onPress={cancel} variant="outline" style={{ borderColor: C.dangerBorder }} textStyle={{ color: C.dangerInk }} />
              </>
            ) : myReq.status === 'accepted' ? (
              <Btn icon="mail" label={`Message ${owner.name}`} onPress={messageGiver} style={{ flex: 1 }} />
            ) : (
              <Btn label="Request declined" onPress={undefined} style={{ flex: 1, opacity: 0.55 }} variant="outline" textStyle={{ color: C.muted }} />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={{ backgroundColor: accent ? C.accentSoft : C.bg, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 15 }}>
      <Text style={{ fontSize: 13, fontWeight: accent ? '700' : '600', color: accent ? C.accent : C.ink }}>{text}</Text>
    </View>
  );
}

const galBtn = { position: 'absolute', width: 46, height: 46, borderRadius: radius.lg, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -6px rgba(0,0,0,0.35)' } as const;
const StyleAbs = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
