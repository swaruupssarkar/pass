import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { REPORT_REASONS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { usePass } from '@/pass/store';
import { C } from '@/pass/theme';
import { Btn, Header, SafetyNote, Screen, t } from '@/pass/ui';

export default function Report() {
  const router = useRouter();
  const { s, patch, submitReport } = usePass();

  if (s.reportDone) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Report & block" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.free, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={48} color="#fff" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 20 }}>Thanks for flagging</Text>
          <Text style={{ fontSize: 14.5, color: C.muted, marginTop: 10, textAlign: 'center', maxWidth: 290, lineHeight: 22 }}>
            Our team reviews money-request reports fast. This person can no longer contact you.
          </Text>
          <Btn
            label="Done"
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
          Tell us what&apos;s wrong. Reports are anonymous and reviewed by our safety team.
        </Text>
        <View style={{ gap: 10 }}>
          {REPORT_REASONS.map((label, i) => {
            const sel = s.reportReason === i;
            return (
              <Pressable
                key={i}
                onPress={() => patch({ reportReason: i })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1.5, borderColor: sel ? C.accent : C.line, backgroundColor: C.surface, borderRadius: 15, padding: 15 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: sel ? C.accent : '#CFC6B9', backgroundColor: sel ? C.accent : 'transparent' }} />
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: C.ink }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: 16 }}>
          <SafetyNote
            danger
            text="If someone asked you to pay for a free item, report it — that's the clearest scam signal and we act on it fast."
          />
        </View>
      </ScrollView>
      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn
          label="Submit report & block"
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
