import * as DocumentPicker from 'expo-document-picker';
import * as MailComposer from 'expo-mail-composer';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { capture } from '@/pass/analytics';
import { SUPPORT_EMAIL } from '@/pass/config';
import { Icon } from '@/pass/icon';
import { userName, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen } from '@/pass/ui';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const CATS = ['bug', 'feature', 'other'] as const;
type Cat = (typeof CATS)[number];

type Picked = { uri: string; name: string; size: number };

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Feedback() {
  const router = useRouter();
  const tr = useT();
  const { s, showAlert } = usePass();
  const [cat, setCat] = useState<Cat>('bug');
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // synchronous double-tap lock — busy state lands a frame late

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if ((a.size ?? 0) > MAX_BYTES) return showAlert(tr('feedback.tooBigTitle'), tr('feedback.tooBigBody'));
    setFile({ uri: a.uri, name: a.name, size: a.size ?? 0 });
  };

  const send = async () => {
    if (inFlight.current || busy) return;
    if (!msg.trim()) return showAlert(tr('feedback.emptyTitle'), tr('feedback.emptyBody'));
    inFlight.current = true;
    setBusy(true);
    try {
      if (!(await MailComposer.isAvailableAsync())) {
        setBusy(false);
        return showAlert(tr('feedback.noMailTitle'), `${tr('feedback.noMailBody')} ${SUPPORT_EMAIL}`);
      }
      const label = tr(`feedback.cat_${cat}`);
      const name = userName(s, s.currentUserId);
      const body = `${msg.trim()}\n\n— ${name}\nCategory: ${label}\nSent from the Daata app`;
      const r = await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject: `[Daata · ${label}] feedback`,
        body,
        attachments: file ? [file.uri] : undefined,
      });
      setBusy(false);
      capture('feedback_submitted', { category: cat, hasAttachment: !!file, status: r.status });
      // only a real send counts — 'saved' (iOS draft) is treated like cancel
      if (r.status === 'sent') {
        showAlert(tr('feedback.thanksTitle'), tr('feedback.thanksBody'));
        router.back();
      }
    } catch {
      setBusy(false);
      showAlert(tr('feedback.failTitle'), tr('feedback.failBody'));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Screen>
      <Header title={tr('feedback.title')} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>{tr('feedback.subtitle')}</Text>

          {/* category */}
          <Text style={label}>{tr('feedback.category')}</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {CATS.map((c) => {
              const on = cat === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    backgroundColor: on ? C.accentSoft : C.surface,
                    borderWidth: 1.5,
                    borderColor: on ? C.accent : C.line,
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: on ? C.accent : C.ink }}>{tr(`feedback.cat_${c}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* message */}
          <Text style={[label, { marginTop: 22 }]}>{tr('feedback.message')}</Text>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder={tr('feedback.placeholder')}
            placeholderTextColor={C.muted}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 130, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 15, color: C.ink, lineHeight: 21 }}
          />

          {/* attachment */}
          <Text style={[label, { marginTop: 22 }]}>{tr('feedback.attachLabel')}</Text>
          {file ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, paddingVertical: 13, paddingHorizontal: 14, gap: 10 }}>
              <Icon name="clipboard" size={18} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, color: C.ink, fontWeight: '600' }}>{file.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{fmtSize(file.size)}</Text>
              </View>
              <Pressable onPress={() => setFile(null)} hitSlop={8}>
                <Icon name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pick}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, paddingVertical: 15 }}>
              <Icon name="add" size={18} color={C.muted} />
              <Text style={{ fontSize: 13.5, color: C.muted, fontWeight: '600' }}>{tr('feedback.attach')}</Text>
            </Pressable>
          )}

          <Btn icon="send" label={busy ? tr('feedback.sending') : tr('feedback.send')} onPress={send} block style={{ marginTop: 26, borderRadius: radius.lg }} />
          <Text style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>{tr('feedback.privacy')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const label = { fontSize: 13, fontWeight: '700' as const, color: C.ink, marginBottom: 9 };
