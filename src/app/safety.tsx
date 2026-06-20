import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen, t } from '@/pass/ui';

const TIPS = [
  { n: '1', title: 'Never pay anyone', body: 'No delivery fee, no deposit, no "advance to hold it". Ever.' },
  { n: '2', title: 'Meet in a public, busy spot', body: 'A metro gate, market, or building lobby in daylight is ideal.' },
  { n: '3', title: 'Keep chat inside pass', body: 'Your phone number stays private until you choose to share it.' },
];

export default function Safety() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Safety center" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: C.accent, borderRadius: radius.xl, borderCurve: 'continuous', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>Free means free.</Text>
          <Text style={{ fontSize: 14, color: '#fff', opacity: 0.93, marginTop: 8, lineHeight: 22 }}>
            Everything on pass is given away at no cost. If anyone asks you to pay, scan a QR code, or share an OTP — it&apos;s a scam. Stop and report them.
          </Text>
        </View>

        <Text style={[t.title, { marginVertical: 16, marginTop: 22 }]}>How to stay safe</Text>
        <View style={{ gap: 11 }}>
          {TIPS.map((tip) => (
            <View key={tip.n} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.surface, borderRadius: 15, padding: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.accent, fontWeight: '800' }}>{tip.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{tip.title}</Text>
                <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 18 }}>{tip.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBorder, borderRadius: radius.lg, padding: 16, marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>Someone asked you for money?</Text>
          <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 5, lineHeight: 19 }}>
            That&apos;s the clearest scam signal on a free item. Report it — we flag these hard.
          </Text>
          <Btn label="Report & block" onPress={() => router.push('/report')} style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 12, paddingHorizontal: 18 }} textStyle={{ fontSize: 14 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
