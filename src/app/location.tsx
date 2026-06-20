import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { usePass } from '@/pass/store';
import { C } from '@/pass/theme';
import { Btn, Screen, t } from '@/pass/ui';

export default function Location() {
  const router = useRouter();
  const { useCurrentLocation } = usePass();
  const allow = async () => {
    await useCurrentLocation();
    router.push('/notif');
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" size={52} color={C.accent} />
          </View>
          <Text style={[t.h1, { marginTop: 30 }]}>Turn on location</Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
            So we can show you free items closest to you. Your exact spot is never shared with anyone.
          </Text>
        </View>
        <Btn label="Allow location" onPress={allow} block />
        <Btn label="Not now" variant="ghost" onPress={() => router.push('/city')} block style={{ marginTop: 4 }} />
      </View>
    </Screen>
  );
}
