import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { GoogleG } from '@/pass/google-icon';
import { Icon, type IconName } from '@/pass/icon';
import { usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, shadow, t } from '@/pass/ui';

type Mode = 'signin' | 'signup';
type Step = 'email' | 'otp' | 'password';

const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);

export default function Login() {
  const router = useRouter();
  const { s, signInWithEmail, verifyOtp, signInWithPassword, setPassword, getAuthIdentities, signInWithGoogle, showAlert } = usePass();

  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('email'); // sign-up sub-step
  const [reset, setReset] = useState(false); // forgot-password reuses the sign-up flow
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds until "Resend code" is allowed again

  // tick the resend cooldown down to zero
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const go = () => router.replace(s.onboarded ? '/feed' : '/location');

  // Step back through the flow; never leaves the logged-out login screen.
  const back = () => {
    if (step === 'password') return setStep('otp');
    if (step === 'otp') return setStep('email');
    if (step === 'email' && mode === 'signup') return toSignin();
  };

  // Logged out → dead-end. Hardware-back steps back within sign-up, otherwise no-op.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        back();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, step]),
  );

  const toSignin = () => {
    setMode('signin');
    setStep('email');
    setReset(false);
    setCode('');
    setPw('');
    setPw2('');
  };
  const toSignup = () => {
    setMode('signup');
    setStep('email');
    setReset(false);
    setCode('');
    setPw('');
    setPw2('');
  };

  // at the sign-in password step: forgot → switch to setting a new password
  // (email is already OTP-verified, so the session exists to update it).
  const forgot = () => {
    setReset(true);
    setPw('');
    setPw2('');
  };

  // send the one-time email code (both sign-in and sign-up verify email first)
  const sendCode = async () => {
    const e = email.trim();
    if (!emailOk(e)) return showAlert('Enter a valid email', mode === 'signin' ? 'Use the email you signed up with.' : 'We’ll send you a verification code.');
    setBusy(true);
    const r = await signInWithEmail(e);
    setBusy(false);
    if (!r.ok) return showAlert('Could not send code', friendly(r.error));
    setStep('otp');
    setCode('');
    setCooldown(30);
  };

  // resend the OTP from the code screen (rate-limited by the cooldown)
  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    const r = await signInWithEmail(email.trim());
    setBusy(false);
    if (!r.ok) return showAlert('Could not resend', friendly(r.error));
    setCode('');
    setCooldown(30);
    showAlert('Code sent', `We’ve sent a new code to ${email}.`);
  };

  // verify the code → user now has a session; move on to the password step.
  // For sign-in, if the account has no email/password identity yet (e.g. it was
  // created via Google), switch to "create a password" instead of asking for one.
  const verify = async () => {
    if (code.trim().length < 8) return showAlert('Enter the code', 'Check your email for the 8-digit code.');
    setBusy(true);
    const r = await verifyOtp(email, code);
    if (r.ok && mode === 'signin') {
      const ids = await getAuthIdentities();
      if (!ids.includes('email')) setReset(true); // passwordless (Google-only) → create one
    }
    setBusy(false);
    if (!r.ok) return showAlert('Invalid code', friendly(r.error));
    setStep('password');
  };

  // final step. Sign-up / reset → set a new password; sign-in → verify the
  // existing one (email is already OTP-verified at this point).
  const needsNew = mode === 'signup' || reset;
  const finish = async () => {
    if (needsNew) {
      if (pw.length < 8) return showAlert('Weak password', 'Use at least 8 characters.');
      if (pw !== pw2) return showAlert('Passwords don’t match', 'Re-enter the same password.');
      setBusy(true);
      const r = await setPassword(pw);
      setBusy(false);
      if (!r.ok) return showAlert('Could not save password', friendly(r.error));
      go();
    } else {
      if (!pw) return showAlert('Enter your password', 'Your password is required to sign in.');
      setBusy(true);
      const r = await signInWithPassword(email.trim(), pw);
      setBusy(false);
      if (!r.ok) return showAlert('Wrong password', friendly(r.error));
      go();
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.cancelled) return;
    if (!r.ok) return showAlert('Google sign-in failed', friendly(r.error));
    go();
  };

  const showBack = step !== 'email' || mode === 'signup';
  const heading = headingFor(mode, step, reset, email);

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* top bar: back arrow (sign-up only) */}
          <View style={{ height: 44, justifyContent: 'center' }}>
            {showBack ? (
              <Pressable
                onPress={back}
                hitSlop={10}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: C.line,
                  backgroundColor: C.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...shadow(8, 18, 0.3),
                }}>
                <Icon name="back" size={22} color={C.ink} />
              </Pressable>
            ) : null}
          </View>

          {/* brand + heading */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 26 }}>
            <Image source={require('../../assets/images/icon.png')} style={{ width: 58, height: 58, borderRadius: 16, marginBottom: 18 }} />
            <Text style={[t.h1, { fontSize: 27, textAlign: 'center' }]}>{heading.title}</Text>
            <Text style={[t.muted, { fontSize: 14.5, marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 21 }]}>{heading.subtitle}</Text>
          </View>

          {/* form */}
          <View style={{ gap: 13 }}>
            {step === 'email' ? (
              <>
                <Field icon="mail" value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={sendCode} />
                <Btn label={busy ? 'Sending…' : 'Send code'} onPress={sendCode} block style={{ marginTop: 4, borderRadius: radius.lg }} />
              </>
            ) : step === 'otp' ? (
              <>
                <TextInput
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 8))}
                  placeholder="••••••••"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  returnKeyType="done"
                  onSubmitEditing={verify}
                  autoFocus
                  style={[inputBase, { letterSpacing: 8, textAlign: 'center', fontSize: 22, fontWeight: '800', paddingVertical: 16 }]}
                />
                <Btn label={busy ? 'Verifying…' : 'Verify'} onPress={verify} block style={{ marginTop: 4, borderRadius: radius.lg }} />
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 }}>
                  <Text style={{ fontSize: 14, color: C.muted }}>Didn’t get it?</Text>
                  <Pressable onPress={resend} disabled={cooldown > 0 || busy} hitSlop={8}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: cooldown > 0 ? C.muted : C.accent }}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setStep('email')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>Use a different email</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Field
                  icon="lock"
                  value={pw}
                  onChangeText={setPw}
                  placeholder={needsNew ? 'Password (at least 8 characters)' : 'Password'}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  textContentType={needsNew ? 'newPassword' : 'password'}
                  returnKeyType={needsNew ? 'next' : 'done'}
                  onSubmitEditing={needsNew ? undefined : finish}
                  trailing={<EyeToggle on={showPw} onPress={() => setShowPw((v) => !v)} />}
                />
                {needsNew ? (
                  <Field icon="lock" value={pw2} onChangeText={setPw2} placeholder="Re-enter password" secureTextEntry={!showPw} autoCapitalize="none" textContentType="newPassword" returnKeyType="done" onSubmitEditing={finish} />
                ) : (
                  <Pressable onPress={forgot} hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>Forgot password?</Text>
                  </Pressable>
                )}
                <Btn
                  label={busy ? (needsNew ? 'Saving…' : 'Signing in…') : needsNew ? (reset ? 'Save password' : 'Create account') : 'Sign in'}
                  onPress={finish}
                  block
                  style={{ marginTop: 4, borderRadius: radius.lg }}
                />
              </>
            )}
          </View>

          {/* social — only on the email step */}
          {step === 'email' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                <Text style={{ fontSize: 12.5, color: C.muted, fontWeight: '600' }}>Or continue with</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              </View>
              <Pressable
                onPress={googleSignIn}
                disabled={busy}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  backgroundColor: C.surface,
                  borderWidth: 1.5,
                  borderColor: C.line,
                  borderRadius: radius.lg,
                  borderCurve: 'continuous',
                  paddingVertical: 15,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <GoogleG size={18} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>Continue with Google</Text>
              </Pressable>
            </>
          ) : null}

          <View style={{ flex: 1 }} />

          {/* footer switch */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 22 }}>
            <Text style={{ fontSize: 14, color: C.muted }}>{mode === 'signin' ? 'Don’t have an account? ' : 'Already have an account? '}</Text>
            <Pressable onPress={mode === 'signin' ? toSignup : toSignin} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.accent }}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ---- bits ----

function Field({
  icon,
  trailing,
  ...props
}: { icon: IconName; trailing?: React.ReactNode } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[inputBase, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 0, paddingHorizontal: 14 }]}>
      <Icon name={icon} size={18} color={C.muted} />
      <TextInput
        placeholderTextColor={C.muted}
        autoCorrect={false}
        style={{ flex: 1, fontSize: 15.5, color: C.ink, paddingVertical: 15 }}
        {...props}
      />
      {trailing}
    </View>
  );
}

function EyeToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ padding: 2 }}>
      <Icon name={on ? 'eye-off' : 'eye'} size={19} color={C.muted} />
    </Pressable>
  );
}

function headingFor(mode: Mode, step: Step, reset: boolean, email: string): { title: string; subtitle: string } {
  if (step === 'email')
    return mode === 'signin'
      ? { title: 'Welcome back', subtitle: 'Enter your email to sign in to Daata.' }
      : { title: 'Let’s get started', subtitle: 'Create your Daata account to continue.' };
  if (step === 'otp') return { title: 'Verify your email', subtitle: `We sent an 8-digit code to ${email}.` };
  if (reset) return { title: 'Set a new password', subtitle: 'Choose a new password for your account.' };
  if (mode === 'signup') return { title: 'Create a password', subtitle: 'Almost done — secure your account with a password.' };
  return { title: 'Enter your password', subtitle: 'Email verified — enter your password to sign in.' };
}

// Supabase/network errors can be giant JSON blobs — show something human.
function friendly(err?: string): string {
  if (!err) return 'Please try again.';
  if (/invalid login|invalid credentials|invalid_grant/i.test(err)) return 'Wrong email or password.';
  if (/500|unexpected_failure|error sending|smtp/i.test(err)) return 'Email couldn’t be sent. The email (SMTP) settings need fixing.';
  if (/rate|429|limit/i.test(err)) return 'Too many attempts. Wait a minute and try again.';
  if (/network|fetch|timeout/i.test(err)) return 'Network issue. Check your connection and retry.';
  return err.length > 140 ? err.slice(0, 140) + '…' : err;
}

const inputBase = {
  alignSelf: 'stretch' as const,
  backgroundColor: C.surface,
  borderRadius: radius.md,
  borderCurve: 'continuous' as const,
  borderWidth: 1.5,
  borderColor: C.line,
  paddingHorizontal: 16,
  fontSize: 16,
  color: C.ink,
};
