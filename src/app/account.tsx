import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import type { Gender } from '@/pass/data';
import { ProfileFields } from '@/pass/profile-fields';
import { me, usePass, useT, userName } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen } from '@/pass/ui';

export default function Account() {
  const router = useRouter();
  const tr = useT();
  const { s, saveProfileInfo, showAlert } = usePass();
  const profile = me(s);

  const [name, setName] = useState(() => (profile.name && profile.name !== 'You' ? profile.name : ''));
  const [gender, setGender] = useState<Gender | null>(profile.gender ?? null);
  const [dob, setDob] = useState<string | null>(profile.dob ?? null);

  const dirty =
    (name.trim() || '') !== (profile.name && profile.name !== 'You' ? profile.name : '') ||
    gender !== (profile.gender ?? null) ||
    dob !== (profile.dob ?? null);
  const canSave = name.trim().length > 0 && dirty;

  const save = () => {
    if (!canSave) return;
    saveProfileInfo({ name: name.trim() || userName(s, s.currentUserId), gender, dob });
    showAlert(tr('account.savedTitle'), tr('account.savedBody'));
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={tr('account.title')} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ProfileFields name={name} gender={gender} dob={dob} onName={setName} onGender={setGender} onDob={setDob} />
        </ScrollView>
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <Btn label={tr('common.save')} onPress={save} block style={{ borderRadius: radius.lg, opacity: canSave ? 1 : 0.5 }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
