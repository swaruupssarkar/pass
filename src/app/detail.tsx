import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { fmtKm, haversineKm, type Coords, type Listing } from '@/pass/data';
import { catIcon, Icon } from '@/pass/icon';
import { activeListing, distLabel, fmtDate, fmtRel, myRequestFor, profileOf, reviewsFor, userName, userPoint, userRating, usePass, useT, userDp } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Avatar, Btn, EmptyState, Header, SafetyNote, Screen, VerifiedBadge } from '@/pass/ui';

export default function Detail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const { height, width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const { s, patch, toggleSave, viewPerson, requestListing, openThreadFor, openTakenPicker, showAlert, cancelRequest, showConfirm, loadPublicProfile } = usePass();
  const item = activeListing(s);

  // fetch the owner's reviews so the owner card rating/count is correct for other users
  const ownerId = item?.ownerId;
  useEffect(() => {
    if (ownerId && ownerId !== s.currentUserId) loadPublicProfile(ownerId);
  }, [ownerId, s.currentUserId, loadPublicProfile]);

  if (!item) {
    return (
      <Screen>
        <Header title={tr('detail.listing')} />
        <EmptyState icon="search" title={tr('detail.notFound')} ctaLabel={tr('common.back')} onCta={() => router.back()} />
      </Screen>
    );
  }

  const owner = profileOf(s, item.ownerId);
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
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: C.muted }}>{tr('detail.posted', { rel: fmtRel(item.createdAt, tr), date: fmtDate(item.createdAt) })}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
            <Chip text={tr('cat.' + item.cat)} accent />
            <Chip text={tr('detail.conditionChip', { cond: tr('cond.' + item.cond) })} />
          </View>

          <Pressable onPress={mine ? undefined : viewGiver} style={{ marginTop: 16, backgroundColor: C.bg, borderRadius: radius.lg, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <Avatar name={ownerName} uri={userDp(s, item.ownerId)} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink }}>{ownerName}</Text>
                <VerifiedBadge />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Icon name="star" size={12.5} color={C.star} />
                <Text style={{ fontSize: 12.5, color: C.muted }}>{ownerRating != null ? ownerRating : tr('common.new')}{ownerReviews > 0 ? ` · ${tr('common.reviewsN', { n: ownerReviews })}` : ''} · {tr('giver.memberSince', { year: owner.since ?? '—' })}</Text>
              </View>
            </View>
            {!mine && <Text style={{ color: C.accent, fontSize: 14, fontWeight: '800' }}>{tr('detail.view')}</Text>}
          </Pressable>

          <Text style={{ fontSize: 14.5, color: C.ink, opacity: 0.82, lineHeight: 23, marginTop: 16 }}>{item.desc}</Text>

          <PickupMap item={item} exact={mine || myReq?.status === 'accepted'} />

          {item.taken ? (
            <View style={{ marginTop: 18, backgroundColor: C.bg, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="check-circle" size={18} color={C.muted} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.muted }}>{tr('detail.taken')}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 18 }}>
            <SafetyNote text={tr('detail.safetyNote')} />
          </View>
          <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, alignItems: 'center' }}>
            <Pressable
              onPress={() => router.push('/report')}
              hitSlop={10}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.5 : 1 })}>
              <Icon name="flag" size={12} color={C.muted} />
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.muted, textDecorationLine: 'underline' }}>{tr('detail.report')}</Text>
            </Pressable>
          </View>
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

// read-only OSM/Leaflet preview.
// approx=true (public / not-yet-accepted): only a fuzzy CIRCLE on coarsely-rounded
// coords — no exact pin, no me-line. approx=false (owner / accepted): exact pin + your
// pin + a line + auto-fit. This is what makes "exact address only after accept" real.
const buildMapHtml = (plat: number, plng: number, me: Coords | null, accent: string, approx: boolean) => `<!DOCTYPE html>
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
  ${approx
    ? `var c = [${Math.round(plat * 100) / 100}, ${Math.round(plng * 100) / 100}];
       L.circle(c, { radius: 750, color: '${accent}', weight: 2, fillColor: '${accent}', fillOpacity: 0.15 }).addTo(map);
       map.setView(c, 13);`
    : `L.marker([${plat}, ${plng}], { icon: dot('it') }).addTo(map);
       ${me
         ? `L.marker([${me.lat}, ${me.lng}], { icon: dot('me') }).addTo(map);
            L.polyline([[${me.lat}, ${me.lng}], [${plat}, ${plng}]], { color: '${accent}', weight: 3, dashArray: '6 6', opacity: 0.85 }).addTo(map);
            map.fitBounds([[${me.lat}, ${me.lng}], [${plat}, ${plng}]], { padding: [40, 40] });`
         : `map.setView([${plat}, ${plng}], 14);`}`}
</script></body></html>`;

function PickupMap({ item, exact }: { item: Listing; exact: boolean }) {
  const tr = useT();
  const { s, useCurrentLocation } = usePass();
  const me = userPoint(s);
  const dist = me ? fmtKm(haversineKm(me, { lat: item.lat, lng: item.lng })) : null;
  // exact view gets the precise pin + your-location line; public view gets only a fuzzy circle
  const html = buildMapHtml(item.lat, item.lng, exact ? me : null, C.accent, !exact);

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 11 }}>
        <Icon name="pin" size={15} color={C.accent} />
        {/* exact address only for the owner or an accepted requester; otherwise the area */}
        <Text style={{ flex: 1, fontSize: 14, color: C.ink, lineHeight: 20 }}>{exact && item.address ? item.address : item.area || tr('detail.approxArea')}</Text>
      </View>
      <View style={{ height: 170, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
        <View style={StyleAbs} pointerEvents="none">
          <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: C.bg }} scrollEnabled={false} />
        </View>
        {exact ? (
          <Pressable onPress={openDirections} style={[StyleAbs, { justifyContent: 'flex-end' }]}>
            <View style={{ margin: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(28,24,22,0.8)', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="pin" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{dist ? tr('detail.awayTap', { dist }) : tr('detail.tapOpenMaps')}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[StyleAbs, { justifyContent: 'flex-end' }]} pointerEvents="none">
            <View style={{ margin: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(28,24,22,0.8)', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={13} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{dist ? tr('detail.awayApprox', { dist }) : tr('detail.approxArea')}</Text>
            </View>
          </View>
        )}
      </View>
      {!exact ? (
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 9, lineHeight: 17 }}>{tr('detail.exactAfterAccept')}</Text>
      ) : null}
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
