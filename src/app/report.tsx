import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as MailComposer from 'expo-mail-composer';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { SUPPORT_EMAIL } from '@/pass/config';
import { REPORT_REASONS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { activeListing, userName, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, SafetyNote, Screen, t } from '@/pass/ui';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — email attachment ceiling
const OTHER_REASON = REPORT_REASONS.length - 1; // "Something else"

type Picked = { uri: string; name: string; size: number };
const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Report() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, submitReport, showAlert } = usePass();
  const [detail, setDetail] = useState('');
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // synchronous double-tap lock — busy state lands a frame late

  // start fresh each time the screen opens — a reason picked for one listing must never
  // carry over to another if the user backs out without submitting.
  useFocusEffect(
    useCallback(() => {
      patch({ reportReason: null });
      setDetail('');
      setFiles([]);
    }, [patch])
  );

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

  const isOther = s.reportReason === OTHER_REASON;
  // "Something else" needs a written explanation; other reasons don't.
  const canSubmit = s.reportReason != null && (!isOther || detail.trim().length > 0) && !busy;

  const addMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if ((a.fileSize ?? 0) > MAX_BYTES) return showAlert(tr('feedback.tooBigTitle'), tr('report.tooBigBody'));
    setFiles((f) => [...f, { uri: a.uri, name: a.fileName ?? 'attachment', size: a.fileSize ?? 0 }]);
  };
  const addFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if ((a.size ?? 0) > MAX_BYTES) return showAlert(tr('feedback.tooBigTitle'), tr('report.tooBigBody'));
    setFiles((f) => [...f, { uri: a.uri, name: a.name, size: a.size ?? 0 }]);
  };

  const submit = async () => {
    if (inFlight.current || !canSubmit) return;
    inFlight.current = true;
    const l = activeListing(s);
    setBusy(true);
    try {
      if (!(await MailComposer.isAvailableAsync())) {
        setBusy(false);
        return showAlert(tr('feedback.noMailTitle'), `${tr('feedback.noMailBody')} ${SUPPORT_EMAIL}`);
      }
      const reason = REPORT_REASONS[s.reportReason ?? 0] ?? 'Report';
      const name = userName(s, s.currentUserId);
      const body =
        `Reason: ${reason}\n` +
        `Listing: ${l?.title ?? '-'} (${l?.id ?? s.activeListingId ?? '-'})\n` +
        `Reported by: ${name}\n\n` +
        `Details:\n${detail.trim() || '-'}\n\n` +
        `Sent from the Daata app`;
      const r = await MailComposer.composeAsync({
        recipients: [SUPPORT_EMAIL],
        subject: `[Daata · report] ${l?.title ?? 'listing'}`,
        body,
        attachments: files.length ? files.map((f) => f.uri) : undefined,
      });
      setBusy(false);
      // record the per-listing tally + show the thanks screen — only a real send counts
      // ('saved' = iOS draft, treated like cancel: no thanks, no tally)
      if (r.status === 'sent') submitReport();
    } catch {
      setBusy(false);
      showAlert(tr('feedback.failTitle'), tr('feedback.failBody'));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={tr('report.title')} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[t.small, { marginBottom: 14 }]}>{tr('report.intro')}</Text>
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

          {/* "Something else" → describe the issue (required) */}
          {isOther ? (
            <View style={{ marginTop: 16 }}>
              <Text style={inputLabel}>{tr('report.detailLabel')}</Text>
              <TextInput
                value={detail}
                onChangeText={setDetail}
                placeholder={tr('report.detailPlaceholder')}
                placeholderTextColor={C.muted}
                multiline
                textAlignVertical="top"
                style={{ minHeight: 110, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 15, color: C.ink, lineHeight: 21 }}
              />
            </View>
          ) : null}

          {/* attachments — photo / video / document (optional, helps the safety team) */}
          <Text style={[inputLabel, { marginTop: 20 }]}>{tr('report.attachLabel')}</Text>
          {files.map((f, idx) => (
            <View key={`${f.uri}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14, gap: 10, marginBottom: 9 }}>
              <Icon name="clipboard" size={18} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, color: C.ink, fontWeight: '600' }}>{f.name}</Text>
                {f.size > 0 ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{fmtSize(f.size)}</Text> : null}
              </View>
              <Pressable onPress={() => setFiles((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                <Icon name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={addMedia}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, paddingVertical: 14 }}>
              <Icon name="image" size={18} color={C.muted} />
              <Text style={{ fontSize: 13.5, color: C.muted, fontWeight: '600' }}>{tr('report.addPhoto')}</Text>
            </Pressable>
            <Pressable
              onPress={addFile}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: C.line, paddingVertical: 14 }}>
              <Icon name="add" size={18} color={C.muted} />
              <Text style={{ fontSize: 13.5, color: C.muted, fontWeight: '600' }}>{tr('report.addFile')}</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 18 }}>
            <SafetyNote danger text={tr('report.safetyNote')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn label={busy ? tr('feedback.sending') : tr('report.submit')} onPress={submit} block style={{ opacity: canSubmit ? 1 : 0.5 }} />
      </View>
    </Screen>
  );
}

const inputLabel = { fontSize: 13, fontWeight: '700' as const, color: C.ink, marginBottom: 9 };
