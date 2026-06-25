import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CITY_IMG } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { CITIES, usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';
import { Header, PhotoTile, Screen, t } from '@/pass/ui';

export default function City() {
  const router = useRouter();
  const tr = useT();
  const { s, setCity, useCurrentLocation } = usePass();

  const onUseLocation = async () => {
    await useCurrentLocation();
    router.replace('/feed');
  };

  const onPickCity = (id: string) => {
    setCity(id);
    router.replace('/feed');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={tr('city.title')} />
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 8 }}>
        <Text style={[t.muted, { marginBottom: 18 }]}>{tr('city.subtitle')}</Text>

        {/* current location */}
        <Pressable
          onPress={onUseLocation}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            borderWidth: 2,
            borderColor: s.activeMode === 'gps' ? C.accent : 'transparent',
            backgroundColor: s.activeMode === 'gps' ? C.accentSoft : C.surface,
            padding: 13,
            borderRadius: 18,
            borderCurve: 'continuous',
            marginBottom: 18,
          }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: C.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="pin" size={20} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>{tr('city.useLocation')}</Text>
            <Text style={[t.small, { marginTop: 2 }]}>{tr('city.useLocationHint')}</Text>
          </View>
          <Icon name="forward" size={18} color={C.muted} />
        </Pressable>

        <Text style={[t.label, { marginBottom: 11 }]}>{tr('city.citiesLabel')}</Text>

        <View style={{ gap: 11 }}>
          {CITIES.map((c) => {
            const sel = s.activeMode === 'city' && s.activeCityId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => onPickCity(c.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  borderWidth: 2,
                  borderColor: sel ? C.accent : 'transparent',
                  backgroundColor: sel ? C.accentSoft : C.surface,
                  padding: 11,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                }}>
                <PhotoTile tint={C.bg} source={CITY_IMG[c.id]} gap={12} style={{ width: 58, height: 58, borderRadius: 14 }} />
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.ink }}>{c.name}</Text>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: sel ? C.accent : '#D8CFC2',
                    backgroundColor: sel ? C.accent : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
