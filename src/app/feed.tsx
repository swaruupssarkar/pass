import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { capture } from '@/pass/analytics';
import { catIcon, Icon } from '@/pass/icon';
import {
  activeLocationLabel,
  browseListings,
  CATS,
  distLabel,
  unreadCount,
  usePass,
  useT,
} from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { BottomNav, Btn, EmptyState, FreeTag, PhotoTile, Pill, Screen, shadow, t } from '@/pass/ui';

const RADIUS_PRESETS = [3, 5, 10, 20, 100];

export default function Feed() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, openListing, toggleSave, useCurrentLocation, markOnboarded, showAlert, showConfirm } = usePass();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardW = width >= 600 ? '31.5%' : '48%'; // 3 columns on tablets, 2 on phones
  const items = useMemo(
    () => browseListings(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.listings, s.activeMode, s.activeCityId, s.userLoc, s.radius, s.catFilter, s.q, s.sortMode, s.currentUserId, s.blocked, s.requests]
  );
  const loc = activeLocationLabel(s);
  const unread = unreadCount(s);

  // keep the search box on local state so each keystroke is instant; only push the
  // query into global state (which re-runs browseListings + re-renders) after a pause
  const [query, setQuery] = useState(s.q);
  useEffect(() => {
    const id = setTimeout(() => patch({ q: query }), 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    if (s.q === '' && query !== '') setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.q]);

  // search button / keyboard "search" key: apply immediately (skip the debounce) + close keyboard
  const runSearch = () => {
    const q = query.trim();
    if (q) capture('search_performed', { query: q.toLowerCase(), length: q.length });
    patch({ q });
    Keyboard.dismiss();
  };

  useEffect(() => {
    markOnboarded();
  }, [markOnboarded]);

  const [locating, setLocating] = useState(false);
  const onUseLocation = async () => {
    setLocating(true);
    const r = await useCurrentLocation();
    setLocating(false);
    if (r === 'denied') {
      showConfirm({
        title: tr('feed.locationOffTitle'),
        message: tr('feed.locationOffMsg'),
        cancelLabel: tr('feed.notNow'),
        confirmLabel: tr('feed.openSettings'),
        onConfirm: () => Linking.openSettings(),
      });
    } else if (r === 'error') {
      showAlert(tr('feed.locationErrorTitle'), tr('feed.locationErrorMsg'));
    }
  };

  const open = (id: string) => {
    openListing(id);
    router.push('/detail');
  };
  const clampRadius = (n: number) => Math.max(1, Math.min(500, n));

  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 }}>
        {/* location · my-location icon · radius · bell */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.push('/city')} style={{ flex: 1 }}>
            <Text style={t.label}>{tr('feed.freeStuffIn')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }} numberOfLines={1}>{loc}</Text>
              <Icon name="down" size={11} color={C.accent} />
            </View>
          </Pressable>
          <Pressable
            onPress={onUseLocation}
            disabled={locating}
            style={{ width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: s.activeMode === 'gps' ? C.accent : C.line, backgroundColor: s.activeMode === 'gps' ? C.accent : C.surface, alignItems: 'center', justifyContent: 'center' }}>
            {locating ? (
              <ActivityIndicator size="small" color={s.activeMode === 'gps' ? '#fff' : C.accent} />
            ) : (
              <Icon name="pin" size={18} color={s.activeMode === 'gps' ? '#fff' : C.accent} />
            )}
          </Pressable>
          <Pressable
            onPress={() => patch({ showRadius: true })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 42, paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.ink }}>{s.radius} km</Text>
            <Icon name="down" size={11} color={C.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/notifs')}
            style={{ width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={18} color={C.ink} />
            {unread > 0 ? <View style={{ position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent, borderWidth: 2, borderColor: C.surface }} /> : null}
          </Pressable>
        </View>

        {/* search bar + search button */}
        <View style={{ flexDirection: 'row', gap: 11, marginTop: 13 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.lg, paddingHorizontal: 16, height: 52, ...shadow(6, 18, 0.4) }}>
            <Icon name="search" size={15} color={C.accent} />
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={runSearch} placeholder={tr('feed.searchPlaceholder')} placeholderTextColor={C.muted} returnKeyType="search" style={{ flex: 1, fontSize: 14.5, color: C.ink }} />
          </View>
          <Pressable onPress={runSearch} style={{ width: 52, height: 52, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -8px ${C.accent}` }}>
            <Icon name="search" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* categories — image tiles */}
        <View style={{ paddingHorizontal: 18, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t.title}>{tr('feed.categories')}</Text>
          <Pressable onPress={() => router.push('/categories')}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>{tr('common.seeAll')}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingHorizontal: 18, paddingVertical: 12 }}>
          {CATS.map((c) => {
            const sel = s.catFilter === c;
            return (
              <Pressable key={c} onPress={() => patch({ catFilter: sel ? null : c, q: '' })} style={{ alignItems: 'center', gap: 8, width: 72 }}>
                <View style={{ width: 72, height: 72, borderRadius: 20, borderCurve: 'continuous', backgroundColor: sel ? C.accentSoft : C.surface, borderWidth: 1.5, borderColor: sel ? C.accent : C.line, alignItems: 'center', justifyContent: 'center', ...shadow(8, 18, 0.4) }}>
                  <Icon name={catIcon(c)} size={30} color={C.accent} />
                </View>
                <Text numberOfLines={2} style={{ fontSize: 11, fontWeight: sel ? '800' : '600', color: sel ? C.accent : C.ink, textAlign: 'center' }}>{tr('cat.' + c)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={t.h3}>
            {tr('feed.nearby')} <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>· {tr('feed.countFree', { n: items.length })}</Text>
          </Text>
          <Pressable onPress={() => patch({ sortMode: s.sortMode === 'Nearest' ? 'Newest' : 'Nearest' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="sort" size={14} color={C.accent} />
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '700' }}>{s.sortMode === 'Nearest' ? tr('feed.sortNearest') : tr('feed.sortNewest')}</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <EmptyState
            brand
            icon="search"
            title={tr('feed.nothingIn', { loc })}
            body={tr('feed.nothingHint')}
            ctaLabel={s.catFilter || s.q ? tr('feed.clearFilters') : undefined}
            onCta={s.catFilter || s.q ? () => patch({ q: '', catFilter: null }) : undefined}
          />
        ) : (
          <View style={{ paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {items.map((it) => {
              const saved = !!s.saved[it.id];
              const d = distLabel(s, it);
              return (
                <Pressable key={it.id} onPress={() => open(it.id)} style={{ width: cardW, backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 9, marginBottom: 14, ...shadow(10, 26, 0.4) }}>
                  <PhotoTile tint={it.tint} uri={it.photos?.[0]} icon={catIcon(it.cat)} iconSize={50} gap={20} style={{ aspectRatio: 1, borderRadius: radius.md }}>
                    {d ? (
                      <View style={{ position: 'absolute', top: 9, left: 9, backgroundColor: 'rgba(28,24,22,0.62)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{d}</Text>
                      </View>
                    ) : null}
                    <Pressable onPress={() => toggleSave(it.id)} style={{ position: 'absolute', top: 7, right: 7, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px -3px rgba(0,0,0,0.3)' }}>
                      <Icon name={saved ? 'heart' : 'heart-outline'} size={16} color={C.accent} />
                    </Pressable>
                    <FreeTag style={{ position: 'absolute', bottom: 9, left: 9 }} />
                  </PhotoTile>
                  <View style={{ paddingHorizontal: 6, paddingTop: 11, paddingBottom: 6 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>{it.title}</Text>
                    <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }} numberOfLines={1}>{it.area}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav active="home" />

      {/* radius picker — in-screen overlay so the feed shows through */}
      {s.showRadius ? (
      <View style={StyleSheet.absoluteFill}>
        <Pressable onPress={() => patch({ showRadius: false })} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.35)' }]} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous', padding: 22, paddingTop: 8, paddingBottom: insets.bottom + 22 }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={t.h3}>{tr('feed.searchRadius')}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>{tr('feed.withinKm', { n: s.radius })}</Text>
          </View>
          <Text style={[t.small, { marginTop: 5 }]}>{tr('feed.radiusDesc', { loc })}</Text>

          {/* rounded stepper with manual entry */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', marginTop: 16, height: 54 }}>
            <Pressable onPress={() => patch({ radius: clampRadius(s.radius - 1) })} style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="remove" size={22} color={C.ink} />
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <TextInput
                value={String(s.radius)}
                onChangeText={(v) => patch({ radius: clampRadius(parseInt(v.replace(/[^0-9]/g, ''), 10) || 1) })}
                keyboardType="number-pad"
                style={{ minWidth: 40, fontSize: 20, fontWeight: '800', color: C.ink, textAlign: 'center', fontVariant: ['tabular-nums'] }}
              />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.muted }}>km</Text>
            </View>
            <Pressable onPress={() => patch({ radius: clampRadius(s.radius + 1) })} style={{ width: 54, height: 54, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add" size={22} color={C.ink} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {RADIUS_PRESETS.map((n) => (
              <Pill key={n} label={`${n} km`} selected={s.radius === n} tone="soft" onPress={() => patch({ radius: n })} />
            ))}
          </View>

          <Btn label={tr('feed.showItems', { n: items.length })} onPress={() => patch({ showRadius: false })} block style={{ marginTop: 22 }} />
        </View>
      </View>
      ) : null}
    </Screen>
  );
}
