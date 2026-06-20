import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';
import { Btn, Screen, t } from '@/pass/ui';

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
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pin" size={52} color={C.accent} />
          </View>
          <Text style={[t.h1, { marginTop: 30 }]}>{tr('location.title')}</Text>
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
