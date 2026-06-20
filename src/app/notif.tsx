import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Icon } from '@/pass/icon';
import { C } from '@/pass/theme';
import { Btn, Screen, t } from '@/pass/ui';

export default function Notif() {
  const router = useRouter();
  const toCity = () => router.push('/city');

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 120, height: 120, borderRadius: 32, borderCurve: 'continuous', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={52} color={C.accent} />
            <View
              style={{
                position: 'absolute',
                top: 28,
                right: 30,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: C.accent,
                borderWidth: 2.5,
                borderColor: C.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>1</Text>
            </View>
          </View>
          <Text style={[t.h1, { marginTop: 30, textAlign: 'center' }]}>Get the good stuff first</Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
            Get a ping when something free pops up near you. Good items go fast — and alerts are always free.
          </Text>
        </View>
        <Btn label="Turn on notifications" onPress={toCity} block />
        <Btn label="Maybe later" variant="ghost" onPress={toCity} block style={{ marginTop: 4 }} />
      </View>
    </Screen>
  );
}
