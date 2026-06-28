import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { capture } from '@/pass/analytics';
import type { Gender } from '@/pass/data';
import { ProfileFields } from '@/pass/profile-fields';
import { me, usePass, useT, userName } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, t } from '@/pass/ui';

export default function ProfileSetup() {
  const router = useRouter();
  const tr = useT();
  const { s, saveProfileInfo } = usePass();
  const profile = me(s);

  // prefill from any existing profile (re-entry mid-onboarding shouldn't wipe input)
  const [name, setName] = useState(() => (profile.name && profile.name !== 'You' ? profile.name : ''));
  const [gender, setGender] = useState<Gender | null>(profile.gender ?? null);
  const [dob, setDob] = useState<string | null>(profile.dob ?? null);

  useEffect(() => {
    capture('onboarding_started'); // first onboarding step — funnel anchor
  }, []);

  const canContinue = name.trim().length > 0 && gender != null && dob != null;

  const next = () => {
    if (!canContinue) return;
    saveProfileInfo({ name: name.trim() || userName(s, s.currentUserId), gender, dob });
    router.replace('/notif');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[t.h1, { fontSize: 27, lineHeight: 33 }]}>{tr('profileSetup.title')}</Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 8, marginBottom: 26, lineHeight: 22 }]}>{tr('profileSetup.subtitle')}</Text>
          <ProfileFields name={name} gender={gender} dob={dob} onName={setName} onGender={setGender} onDob={setDob} />
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
          <Btn label={tr('common.continue')} onPress={next} block style={{ borderRadius: radius.lg, opacity: canContinue ? 1 : 0.5 }} />
          <Text style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', marginTop: 10 }}>{tr('profileSetup.hint')}</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
