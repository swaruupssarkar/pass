import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { usePass, useT } from '@/pass/store';
import { AnimatedIconHero, Btn, Screen, t } from '@/pass/ui';

export default function Notif() {
  const router = useRouter();
  const tr = useT();
  const { requestNotifications } = usePass();
  const toCity = () => router.push('/city');
  const enable = async () => {
    await requestNotifications();
    router.push('/city');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedIconHero icon="bell" disc={132} iconSize={56} badge="1" />
          <Text style={[t.h1, { marginTop: 18, textAlign: 'center' }]}>{tr('notif.title')}</Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
            {tr('notif.subtitle')}
          </Text>
        </View>
        <Btn label={tr('notif.turnOn')} onPress={enable} block />
        <Btn label={tr('notif.maybeLater')} variant="ghost" onPress={toCity} block style={{ marginTop: 4 }} />
      </View>
    </Screen>
  );
}
