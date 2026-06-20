import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen, t } from '@/pass/ui';

const TIPS = ['1', '2', '3'];

export default function Safety() {
  const router = useRouter();
  const tr = useT();
  return (
    <Screen>
      <Header title={tr('safety.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: C.accent, borderRadius: radius.xl, borderCurve: 'continuous', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{tr('safety.heroTitle')}</Text>
          <Text style={{ fontSize: 14, color: '#fff', opacity: 0.93, marginTop: 8, lineHeight: 22 }}>
            {tr('safety.heroBody')}
          </Text>
        </View>

        <Text style={[t.title, { marginVertical: 16, marginTop: 22 }]}>{tr('safety.howTo')}</Text>
        <View style={{ gap: 11 }}>
          {TIPS.map((n) => (
            <View key={n} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.surface, borderRadius: 15, padding: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.accent, fontWeight: '800' }}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{tr('safety.tip' + n + 'Title')}</Text>
                <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 18 }}>{tr('safety.tip' + n + 'Body')}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBorder, borderRadius: radius.lg, padding: 16, marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>{tr('safety.moneyTitle')}</Text>
          <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 5, lineHeight: 19 }}>
            {tr('safety.moneyBody')}
          </Text>
          <Btn label={tr('safety.reportBlock')} onPress={() => router.push('/report')} style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 12, paddingHorizontal: 18 }} textStyle={{ fontSize: 14 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
