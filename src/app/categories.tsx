import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { browseListings, CATS, distLabel, usePass } from '@/pass/store';
import { C, radius, TINTS } from '@/pass/theme';
import { BottomNav, Btn, FreeTag, Header, PhotoTile, Screen, shadow, t } from '@/pass/ui';

export default function Categories() {
  const router = useRouter();
  const { s, patch, openListing } = usePass();
  const selCat = CATS[s.catSel];
  const products = browseListings({ ...s, catFilter: selCat, q: '' });

  const open = (id: string) => {
    openListing(id);
    router.push('/detail');
  };
  const seeAll = () => {
    patch({ catFilter: selCat, q: '' });
    router.navigate('/feed');
  };

  return (
    <Screen bg={C.surface}>
      <Header
        title="All categories"
        right={
          <Pressable onPress={() => { patch({ catFilter: null, q: '' }); router.navigate('/feed'); }} hitSlop={8}>
            <Icon name="search" size={18} color={C.muted} />
          </Pressable>
        }
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* left rail */}
        <ScrollView style={{ width: 72, flexGrow: 0, flexShrink: 0, backgroundColor: C.bg, borderRightWidth: 1, borderRightColor: C.line }} showsVerticalScrollIndicator={false}>
          {CATS.map((c, i) => {
            const sel = i === s.catSel;
            return (
              <Pressable key={c} onPress={() => patch({ catSel: i })} style={{ alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, backgroundColor: sel ? C.accentSoft : 'transparent' }}>
                {sel ? <View style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, backgroundColor: C.accent }} /> : null}
                <PhotoTile tint={TINTS[i % 9]} gap={12} style={{ width: 40, height: 40, borderRadius: radius.md }} />
                <Text numberOfLines={2} style={{ fontSize: 10, lineHeight: 12, fontWeight: sel ? '800' : '600', color: sel ? C.accent : C.ink, textAlign: 'center' }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* right pane: banner + products */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* banner */}
          <Pressable onPress={seeAll} style={{ borderRadius: 18, borderCurve: 'continuous', backgroundColor: C.accentSoft, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <View style={{ flex: 1 }}>
              <Text style={[t.h3, { fontSize: 19 }]}>{selCat}</Text>
              <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{products.length} free nearby</Text>
            </View>
            <PhotoTile tint="rgba(255,255,255,0.55)" caption={selCat} gap={16} style={{ width: 92, height: 92, borderRadius: radius.lg }} />
          </Pressable>

          {/* products */}
          {products.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 50 }}>
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="search" size={28} color={C.accent} />
              </View>
              <Text style={[t.small, { marginTop: 14, textAlign: 'center' }]}>No {selCat} items free nearby yet</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
              {products.map((l) => (
                <Pressable key={l.id} onPress={() => open(l.id)} style={{ width: '48%', backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 9, marginBottom: 14, ...shadow(10, 26, 0.4) }}>
                  <PhotoTile tint={l.tint} caption={l.ph} uri={l.photos?.[0]} gap={20} style={{ aspectRatio: 1, borderRadius: radius.md }}>
                    <View style={{ position: 'absolute', top: 9, left: 9, backgroundColor: 'rgba(28,24,22,0.62)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{distLabel(s, l)}</Text>
                    </View>
                    <FreeTag style={{ position: 'absolute', bottom: 9, left: 9 }} />
                  </PhotoTile>
                  <View style={{ paddingHorizontal: 6, paddingTop: 11, paddingBottom: 6 }}>
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.ink, letterSpacing: -0.2 }} numberOfLines={1}>{l.title}</Text>
                    <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }} numberOfLines={1}>{l.area}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
      <BottomNav active="home" />
    </Screen>
  );
}
