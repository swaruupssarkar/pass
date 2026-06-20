import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { REPORT_REASONS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';
import { Btn, Header, SafetyNote, Screen, t } from '@/pass/ui';

export default function Report() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, submitReport } = usePass();

  if (s.reportDone) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={tr('report.title')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.free, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={48} color="#fff" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 20 }}>{tr('report.thanks')}</Text>
          <Text style={{ fontSize: 14.5, color: C.muted, marginTop: 10, textAlign: 'center', maxWidth: 290, lineHeight: 22 }}>
            {tr('report.thanksBody')}
          </Text>
          <Btn
            label={tr('common.done')}
            onPress={() => {
              patch({ reportDone: false, reportReason: null });
              router.back();
            }}
            style={{ marginTop: 24, paddingHorizontal: 28, paddingVertical: 15 }}
          />
        </View>
      </Screen>
    );
  }

  const canSubmit = s.reportReason != null;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Report & block" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        <Text style={[t.small, { marginBottom: 14 }]}>
          {tr('report.intro')}
        </Text>
        <View style={{ gap: 10 }}>
          {REPORT_REASONS.map((_label, i) => {
            const sel = s.reportReason === i;
            return (
              <Pressable
                key={i}
                onPress={() => patch({ reportReason: i })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1.5, borderColor: sel ? C.accent : C.line, backgroundColor: C.surface, borderRadius: 15, padding: 15 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: sel ? C.accent : '#CFC6B9', backgroundColor: sel ? C.accent : 'transparent' }} />
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: C.ink }}>{tr('report.reason' + i)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: 16 }}>
          <SafetyNote
            danger
            text={tr('report.safetyNote')}
          />
        </View>
      </ScrollView>
      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn
          label={tr('report.submit')}
          onPress={() => {
            if (canSubmit) submitReport();
          }}
          block
          style={{ opacity: canSubmit ? 1 : 0.5 }}
        />
      </View>
    </Screen>
  );
}
