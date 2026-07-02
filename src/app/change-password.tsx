import { useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Icon } from '@/pass/icon';
import { usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen } from '@/pass/ui';

// Account → Change password.
//  • Default: verify the current password, then set a new one.
//  • "Forgot password?": email an OTP, verify it, then set a new one (no current pw).
//  • Google-only (passwordless) account: skip straight to creating a password.
// The new password is saved to Supabase via setPassword().
export default function ChangePassword() {
  const router = useRouter();
  const { s, signInWithEmail, verifyOtp, signInWithPassword, setPassword, hasPassword, showAlert } = usePass();
  const email = s.currentUserEmail;

  const [needsOld, setNeedsOld] = useState(true); // false for a passwordless (Google) account
  const [mode, setMode] = useState<'pw' | 'reset'>('pw'); // 'reset' = OTP path (forgot)
  const [cur, setCur] = useState('');
  const [code, setCode] = useState('');
  const [npw, setNpw] = useState('');
  const [npw2, setNpw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0); // resend lock
  const done = useRef(false); // one-shot: router.back() must fire once even on double-tap

  useEffect(() => {
    let alive = true;
    hasPassword().then((h) => alive && setNeedsOld(h));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // "Forgot password?" → email a one-time code, then switch to the reset path.
  const forgot = async () => {
    if (!email) return showAlert('No email on file', 'Please sign out and back in, then try again.');
    setBusy(true);
    const r = await signInWithEmail(email, false); // existing account → don't create
    setBusy(false);
    if (!r.ok) return showAlert('Could not send code', r.error ?? 'Please try again.');
    setMode('reset');
    setCode('');
    setCooldown(30);
  };
  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    const r = await signInWithEmail(email, false);
    setBusy(false);
    if (!r.ok) return showAlert('Could not resend', r.error ?? 'Please try again.');
    setCode('');
    setCooldown(30);
    showAlert('Code sent', `We’ve sent a new code to ${email}.`);
  };

  const submit = async () => {
    if (busy) return; // re-entry guard (double-tap / Enter while in flight)
    // validate
    if (mode === 'reset' && code.trim().length < 8) return showAlert('Enter the code', 'Check your email for the 8-digit code.');
    if (mode === 'pw' && needsOld && !cur) return showAlert('Enter your current password', 'Your current password is required to change it.');
    if (npw.length < 8) return showAlert('Weak password', 'Use at least 8 characters.');
    if (npw !== npw2) return showAlert('Passwords don’t match', 'Re-enter the same new password.');

    setBusy(true);
    // prove identity for the path the user is on
    if (mode === 'reset') {
      const v = await verifyOtp(email, code);
      if (!v.ok) {
        setBusy(false);
        return showAlert('Invalid code', v.error ?? 'Please check the code and try again.');
      }
    } else if (needsOld) {
      const v = await signInWithPassword(email, cur); // re-auth = verify current password
      if (!v.ok) {
        setBusy(false);
        return showAlert('Current password is incorrect', 'Please check it and try again.');
      }
    }
    const r = await setPassword(npw);
    setBusy(false);
    if (!r.ok) return showAlert('Could not update password', r.error ?? 'Please try again.');
    showAlert('Password updated', 'Your password has been changed.');
    if (done.current) return;
    done.current = true;
    router.back();
  };

  const title = mode === 'reset' ? 'Reset password' : needsOld ? 'Change password' : 'Create password';
  const intro =
    mode === 'reset'
      ? `Enter the 8-digit code we sent to ${email}, then choose a new password.`
      : needsOld
      ? 'Enter your current password, then choose a new one.'
      : 'Set a password for your account so you can sign in with email too.';

  return (
    <Screen>
      <Header title={title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 14, color: C.muted, lineHeight: 20 }}>{intro}</Text>

          {mode === 'reset' ? (
            <>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus
                style={{ backgroundColor: C.surface, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.line, paddingVertical: 16, fontSize: 22, fontWeight: '800', letterSpacing: 8, textAlign: 'center', color: C.ink }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 13.5, color: C.muted }}>Didn’t get it?</Text>
                <Pressable onPress={resend} disabled={cooldown > 0 || busy} hitSlop={8}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: cooldown > 0 ? C.muted : C.accent }}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : needsOld ? (
            <>
              <PwField value={cur} onChangeText={setCur} placeholder="Current password" show={show} onToggle={() => setShow((v) => !v)} textContentType="password" returnKeyType="next" />
              <Pressable onPress={forgot} disabled={busy} hitSlop={8} style={{ alignSelf: 'flex-end', paddingVertical: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>Forgot password?</Text>
              </Pressable>
            </>
          ) : null}

          <PwField value={npw} onChangeText={setNpw} placeholder="New password (at least 8 characters)" show={show} onToggle={() => setShow((v) => !v)} textContentType="newPassword" returnKeyType="next" />
          <PwField value={npw2} onChangeText={setNpw2} placeholder="Re-enter new password" show={show} onToggle={() => setShow((v) => !v)} textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} />

          <Btn label={busy ? 'Updating…' : mode === 'reset' ? 'Reset password' : 'Update password'} onPress={submit} disabled={busy} block style={{ marginTop: 6, borderRadius: radius.lg }} />

          {mode === 'reset' ? (
            <Pressable onPress={() => setMode('pw')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.muted }}>Use current password instead</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PwField({ show, onToggle, ...props }: { show: boolean; onToggle: () => void } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14 }}>
      <Icon name="lock" size={18} color={C.muted} />
      <TextInput
        placeholderTextColor={C.muted}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ flex: 1, fontSize: 15.5, color: C.ink, paddingVertical: 15 }}
        {...props}
      />
      <Pressable onPress={onToggle} hitSlop={10} style={{ padding: 2 }}>
        <Icon name={show ? 'eye-off' : 'eye'} size={19} color={C.muted} />
      </Pressable>
    </View>
  );
}
