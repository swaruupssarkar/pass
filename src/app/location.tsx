import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { usePass, useT } from '@/pass/store';
import { AnimatedIconHero, Btn, Screen, t } from '@/pass/ui';

export default function Location() {
  const router = useRouter();
  const tr = useT();
  const { useCurrentLocation } = usePass();
  const allow = async () => {
    await useCurrentLocation();
    router.push('/notif');
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedIconHero icon="pin" disc={132} iconSize={56} />
          <Text style={[t.h1, { marginTop: 18 }]}>{tr('location.title')}</Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
            {tr('location.body')}
          </Text>
        </View>
        <Btn label={tr('location.allow')} onPress={allow} block />
        <Btn label={tr('location.notNow')} variant="ghost" onPress={() => router.push('/city')} block style={{ marginTop: 4 }} />
      </View>
    </Screen>
  );
}
