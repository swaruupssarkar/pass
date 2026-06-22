import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { fmtKm, haversineKm, type Coords, type Listing } from '@/pass/data';
import { catIcon, Icon } from '@/pass/icon';
import { activeListing, distLabel, fmtAgo, fmtDate, myRequestFor, reviewsFor, userName, userPoint, userRating, USERS, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, Header, SafetyNote, Screen, VerifiedBadge, t } from '@/pass/ui';

export default function Detail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const { height, width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const { s, patch, toggleSave, viewPerson, requestListing, openThreadFor, openTakenPicker, showAlert, cancelRequest, showConfirm } = usePass();
  const item = activeListing(s);

  if (!item) {
    return (
      <Screen>
        <Header title={tr('detail.listing')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={32} color={C.accent} />
          </View>
          <Text style={[t.h3, { marginTop: 16 }]}>{tr('detail.notFound')}</Text>
          <Btn label={tr('common.back')} onPress={() => router.back()} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
        </View>
      </Screen>
    );
  }

  const owner = USERS[item.ownerId];
  const ownerName = userName(s, item.ownerId);
  const ownerRating = userRating(s, item.ownerId);
  const ownerReviews = reviewsFor(s, item.ownerId).length;
  const mine = item.ownerId === s.currentUserId;
  const myReq = myRequestFor(s, item.id);
  const saved = !!s.saved[item.id];
  const photos = item.photos ?? [];
  const count = photos.length > 0 ? photos.length : 1;
  const gal = Math.min(idx, count - 1);
  const sheetTop = height * (s.sheetExpanded ? 0.07 : 0.46);
  const galleryH = height * 0.46; // image band sits above the (collapsed) sheet
  const bandH = galleryH + 26; // tuck under the sheet's rounded corners so no tint shows through

  const viewGiver = () => {
    viewPerson(item.ownerId);
    router.push('/giver');
  };
  const wantThis = () => {
    requestListing(item.id, '');
    showAlert(tr('detail.requestSentTitle'), tr('detail.requestSentMsg', { name: ownerName }));
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
      title: tr('detail.cancelRequestTitle'),
      message: tr('detail.cancelRequestMsg', { title: item.title }),
      confirmLabel: tr('detail.cancelRequestConfirm'),
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
      {/* gallery — swipeable pager, uniform images, dots at the bottom */}
      <View style={{ height: bandH, backgroundColor: item.tint }}>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {photos.map((p) => (
              <Image key={p} source={{ uri: p }} style={{ width, height: bandH }} contentFit="cover" transition={150} />
            ))}
          </ScrollView>
        ) : (
          <View style={[StyleAbs, { alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name={catIcon(item.cat)} size={88} color={C.accent} />
          </View>
        )}

        <Pressable onPress={() => router.back()} style={[galBtn, { top: insets.top + 6, left: 16 }]}>
          <Icon name="back" size={22} color={C.ink} />
        </Pressable>
        <Pressable onPress={() => toggleSave(item.id)} style={[galBtn, { top: insets.top + 6, right: 16 }]}>
          <Icon name={saved ? 'heart' : 'heart-outline'} size={20} color={C.accent} />
        </Pressable>

        {count > 1 ? (
          <View style={{ position: 'absolute', bottom: 38, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: count }).map((_, i) => (
              <View key={i} style={{ width: i === gal ? 22 : 7, height: 6, borderRadius: 3, backgroundColor: i === gal ? '#fff' : 'rgba(255,255,255,0.6)' }} />
            ))}
          </View>
        ) : null}
      </View>

      {/* bottom sheet */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetTop, backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', boxShadow: '0 -14px 40px -16px rgba(0,0,0,0.3)' }}>
        <GestureDetector gesture={sheetPan}>
          <Pressable onPress={() => patch({ sheetExpanded: !s.sheetExpanded })} style={{ alignItems: 'center', gap: 5, paddingTop: 11, paddingBottom: 6 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>{s.sheetExpanded ? tr('detail.showLess') : tr('detail.showMore')}</Text>
          </Pressable>
        </GestureDetector>

        <ScrollView scrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 25, fontWeight: '800', color: C.ink, letterSpacing: -0.6, lineHeight: 29 }}>{item.title}</Text>
            <View style={{ backgroundColor: C.free, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.4 }}>{tr('detail.free')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 }}>
            <Icon name="pin" size={15} color={C.accent} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.accent }}>{distLabel(s, item) ? `${distLabel(s, item)} · ` : ''}{item.area}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <Icon name="time" size={15} color={C.muted} />
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.muted }}>{tr('detail.posted', { ago: fmtAgo(item.createdAt), date: fmtDate(item.createdAt) })}</Text>
          </View>
          {item.updatedAt ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <Icon name="pencil" size={14} color={C.muted} />
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.muted }}>{tr('detail.lastUpdated', { date: fmtDate(item.updatedAt) })}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
            <Chip text={tr('cat.' + item.cat)} accent />
            <Chip text={tr('detail.conditionChip', { cond: tr('cond.' + item.cond) })} />
            <Chip text={tr('detail.pickupChip', { area: item.area })} />
          </View>

          <Pressable onPress={mine ? undefined : viewGiver} style={{ marginTop: 16, backgroundColor: C.bg, borderRadius: radius.lg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <Avatar name={ownerName} uri={s.dp[item.ownerId]} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{ownerName}</Text>
                <VerifiedBadge />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Icon name="star" size={12.5} color={C.star} />
                <Text style={{ fontSize: 12.5, color: C.muted }}>{ownerRating != null ? ownerRating : tr('common.new')}{ownerReviews > 0 ? ` · ${tr('common.reviewsN', { n: ownerReviews })}` : ''} · {tr('giver.memberSince', { year: owner.since })}</Text>
              </View>
            </View>
            {!mine && <Text style={{ color: C.accent, fontSize: 14, fontWeight: '800' }}>{tr('detail.view')}</Text>}
          </Pressable>

          <Text style={{ fontSize: 14.5, color: C.ink, opacity: 0.82, lineHeight: 23, marginTop: 16 }}>{item.desc}</Text>

          <PickupMap item={item} />

          {item.taken ? (
            <View style={{ marginTop: 18, backgroundColor: C.bg, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="check-circle" size={18} color={C.muted} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.muted }}>{tr('detail.taken')}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 18 }}>
            <SafetyNote text={tr('detail.safetyNote')} />
          </View>
          <Pressable
            onPress={() => router.push('/report')}
            style={({ pressed }) => ({
              alignSelf: 'center',
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 9,
              paddingHorizontal: 16,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: C.bg,
              opacity: pressed ? 0.6 : 1,
            })}>
            <Icon name="flag" size={13} color={C.muted} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.muted }}>{tr('detail.report')}</Text>
          </Pressable>
        </ScrollView>

        {!item.taken ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: C.line }}>
            {mine ? (
              <Btn icon="check" label={tr('detail.markTaken')} onPress={markTaken} style={{ flex: 1 }} />
            ) : !myReq ? (
              <Btn label={tr('detail.wantThis')} onPress={wantThis} style={{ flex: 1 }} />
            ) : myReq.status === 'pending' ? (
              <>
                <Btn icon="time" label={tr('detail.requested')} onPress={undefined} style={{ flex: 1, opacity: 0.55 }} variant="outline" textStyle={{ color: C.muted }} />
                <Btn label={tr('common.cancel')} onPress={cancel} variant="outline" style={{ borderColor: C.dangerBorder }} textStyle={{ color: C.dangerInk }} />
              </>
            ) : myReq.status === 'accepted' ? (
              <Btn icon="mail" label={tr('detail.message', { name: ownerName })} onPress={messageGiver} style={{ flex: 1 }} />
            ) : (
              <Btn label={tr('detail.requestDeclined')} onPress={undefined} style={{ flex: 1, opacity: 0.55 }} variant="outline" textStyle={{ color: C.muted }} />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// read-only OSM/Leaflet preview: product pin, plus your pin + a line + auto-fit when known
const buildMapHtml = (plat: number, plng: number, me: Coords | null, accent: string) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8eef2; }
  .pin { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  .me { background: #2563EB; } .it { background: ${accent}; }
  .leaflet-control-attribution { display: none; }
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  function dot(c) { return L.divIcon({ className: '', html: '<div class="pin ' + c + '"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }); }
  L.marker([${plat}, ${plng}], { icon: dot('it') }).addTo(map);
  ${me
    ? `L.marker([${me.lat}, ${me.lng}], { icon: dot('me') }).addTo(map);
       L.polyline([[${me.lat}, ${me.lng}], [${plat}, ${plng}]], { color: '${accent}', weight: 3, dashArray: '6 6', opacity: 0.85 }).addTo(map);
       map.fitBounds([[${me.lat}, ${me.lng}], [${plat}, ${plng}]], { padding: [40, 40] });`
    : `map.setView([${plat}, ${plng}], 14);`}
</script></body></html>`;

function PickupMap({ item }: { item: Listing }) {
  const tr = useT();
  const { s, useCurrentLocation } = usePass();
  const me = userPoint(s);
  const dist = me ? fmtKm(haversineKm(me, { lat: item.lat, lng: item.lng })) : null;
  const html = buildMapHtml(item.lat, item.lng, me, C.accent);

  const openDirections = () => {
    const dest = `${item.lat},${item.lng}`;
    const url = me
      ? `https://www.google.com/maps/dir/?api=1&origin=${me.lat},${me.lng}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    Linking.openURL(url);
  };

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink, marginBottom: 9 }}>{tr('detail.pickupLocation')}</Text>
      {item.address ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 11 }}>
          <Icon name="pin" size={15} color={C.accent} />
          <Text style={{ flex: 1, fontSize: 14, color: C.ink, lineHeight: 20 }}>{item.address}</Text>
        </View>
      ) : null}
      <View style={{ height: 170, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
        <View style={StyleAbs} pointerEvents="none">
          <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: C.bg }} scrollEnabled={false} />
        </View>
        <Pressable onPress={openDirections} style={[StyleAbs, { justifyContent: 'flex-end' }]}>
          <View style={{ margin: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(28,24,22,0.8)', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="pin" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{dist ? tr('detail.awayTap', { dist }) : tr('detail.tapOpenMaps')}</Text>
          </View>
        </Pressable>
      </View>
      {!me ? (
        <Btn icon="pin" label={tr('detail.useMyLocation')} variant="outline" onPress={() => void useCurrentLocation()} block style={{ marginTop: 10, paddingVertical: 12 }} textStyle={{ fontSize: 13.5 }} />
      ) : null}
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
