import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { CAT_IMG } from '@/pass/data';
import { catIcon, Icon } from '@/pass/icon';
import { browseListings, CATS, distLabel, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { BottomNav, EmptyState, FreeTag, Header, PhotoTile, Screen, shadow, t } from '@/pass/ui';

export default function Categories() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, openListing, toggleSave } = usePass();
  const { width } = useWindowDimensions();
  const cardW = width >= 600 ? '31%' : '48%'; // the left rail leaves less room → 3 cols only on wide tablets
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
        title={tr('categories.title')}
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
                <PhotoTile tint={C.surface} source={CAT_IMG[c]} icon={catIcon(c)} iconSize={22} style={{ width: 44, height: 44, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: sel ? 2 : 1, borderColor: sel ? C.accent : C.line }} />
                <Text numberOfLines={2} style={{ fontSize: 10, lineHeight: 12, fontWeight: sel ? '800' : '600', color: sel ? C.accent : C.ink, textAlign: 'center' }}>{tr('cat.' + c)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* right pane: banner + products */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* banner */}
          <Pressable onPress={seeAll} style={{ borderRadius: 18, borderCurve: 'continuous', backgroundColor: C.accentSoft, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <View style={{ flex: 1 }}>
              <Text style={[t.h3, { fontSize: 19 }]}>{tr('cat.' + selCat)}</Text>
              <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{tr('categories.freeNearby', { n: products.length })}</Text>
            </View>
            <PhotoTile tint={C.surface} source={CAT_IMG[selCat]} icon={catIcon(selCat)} iconSize={42} style={{ width: 92, height: 92, borderRadius: radius.lg, borderCurve: 'continuous' }} />
          </Pressable>

          {/* products */}
          {products.length === 0 ? (
            <EmptyState brand compact icon="search" title={tr('categories.emptyCat', { cat: tr('cat.' + selCat) })} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
              {products.map((l) => (
                <Pressable key={l.id} onPress={() => open(l.id)} style={{ width: cardW, backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', padding: 9, marginBottom: 14, ...shadow(10, 26, 0.4) }}>
                  <PhotoTile tint={l.tint} uri={l.photos?.[0]} icon={catIcon(l.cat)} iconSize={50} gap={20} style={{ aspectRatio: 1, borderRadius: radius.md }}>
                    {distLabel(s, l) ? (
                      <View style={{ position: 'absolute', top: 9, left: 9, backgroundColor: 'rgba(28,24,22,0.62)', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{distLabel(s, l)}</Text>
                      </View>
                    ) : null}
                    <Pressable onPress={() => toggleSave(l.id)} hitSlop={6} style={{ position: 'absolute', top: 7, right: 7, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px -3px rgba(0,0,0,0.3)' }}>
                      <Icon name={s.saved[l.id] ? 'heart' : 'heart-outline'} size={16} color={C.accent} />
                    </Pressable>
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
