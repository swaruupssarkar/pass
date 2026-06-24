import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { capture } from '@/pass/analytics';
import { Icon, type IconName } from '@/pass/icon';
import { usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, shadow, t } from '@/pass/ui';

const ROWS: { icon: IconName; key: string }[] = [
  { icon: 'pin', key: 'row1' },
  { icon: 'flash', key: 'row2' },
  { icon: 'bell', key: 'row3' },
];

export default function Notif() {
  const router = useRouter();
  const tr = useT();
  const { width } = useWindowDimensions();
  const { requestNotifications } = usePass();
  // first onboarding screen — anchors the onboarding funnel (drop-off analysis)
  useEffect(() => {
    capture('onboarding_started');
  }, []);
  const toCity = () => router.push('/city');
  const enable = async () => {
    await requestNotifications();
    router.push('/city');
  };

  const imgW = Math.min(330, Math.round(width * 0.82));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1 }}>
          <Image
            source={require('../../assets/images/notif-illustration.png')}
            style={{ width: imgW, height: imgW / 1.13, alignSelf: 'center' }}
            contentFit="contain"
          />

          <Text style={[t.h1, { fontSize: 27, marginTop: 8, textAlign: 'center' }]}>{tr('notif.title')}</Text>
          <Text style={[t.muted, { fontSize: 14.5, marginTop: 10, textAlign: 'center', maxWidth: 320, alignSelf: 'center', lineHeight: 21 }]}>
            {tr('notif.subtitle')}
          </Text>

          {/* benefit rows */}
          <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', marginTop: 22, paddingHorizontal: 16, ...shadow(10, 26, 0.3) }}>
            {ROWS.map((r, i) => (
              <View
                key={r.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.line }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, borderCurve: 'continuous', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={r.icon} size={19} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{tr('notif.' + r.key + 'Title')}</Text>
                  <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 17 }}>{tr('notif.' + r.key + 'Body')}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Btn label={tr('notif.turnOn')} icon="bell" onPress={enable} block style={{ marginTop: 22, borderRadius: radius.lg }} />
        <Btn label={tr('notif.maybeLater')} variant="ghost" onPress={toCity} block style={{ marginTop: 4 }} />
      </ScrollView>
    </Screen>
  );
}
