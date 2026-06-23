import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { AnimatedIconHero, Btn, Screen, t } from '@/pass/ui';

export default function Login() {
  const router = useRouter();
  const { s, signInWithEmail, verifyOtp, showAlert } = usePass();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return showAlert('Enter a valid email', 'We’ll send you a sign-in code.');
    setBusy(true);
    const r = await signInWithEmail(e);
    setBusy(false);
    if (!r.ok) return showAlert('Could not send code', r.error ?? 'Please try again.');
    setStep('code');
  };

  const verify = async () => {
    if (code.trim().length < 6) return showAlert('Enter the code', 'Check your email for the sign-in code.');
    setBusy(true);
    const r = await verifyOtp(email, code);
    setBusy(false);
    if (!r.ok) return showAlert('Invalid code', r.error ?? 'Double-check the code and try again.');
    router.replace(s.onboarded ? '/feed' : '/location');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AnimatedIconHero icon={step === 'email' ? 'mail' : 'shield'} disc={128} iconSize={54} />
            <Text style={[t.h1, { marginTop: 18, textAlign: 'center' }]}>
              {step === 'email' ? 'Sign in to Daata' : 'Enter your code'}
            </Text>
            <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
              {step === 'email'
                ? 'We’ll email you a one-time code — no password needed.'
                : `We sent a code to ${email}. Enter it below.`}
            </Text>

            {step === 'email' ? (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={sendCode}
                style={inputStyle}
              />
            ) : (
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="••••••"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={verify}
                autoFocus
                style={[inputStyle, { letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '800' }]}
              />
            )}
          </View>

          {step === 'email' ? (
            <Btn label={busy ? 'Sending…' : 'Send code'} onPress={sendCode} block />
          ) : (
            <>
              <Btn label={busy ? 'Verifying…' : 'Verify & continue'} onPress={verify} block />
              <Pressable onPress={() => { setStep('email'); setCode(''); }} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>Use a different email</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const inputStyle = {
  alignSelf: 'stretch' as const,
  marginTop: 24,
  backgroundColor: C.surface,
  borderRadius: radius.md,
  borderCurve: 'continuous' as const,
  borderWidth: 1.5,
  borderColor: C.line,
  paddingHorizontal: 16,
  paddingVertical: 15,
  fontSize: 16,
  color: C.ink,
};
