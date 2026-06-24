import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { langInfo } from '@/pass/i18n';
import { Icon } from '@/pass/icon';
import { activeLocationLabel, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Header, Screen, Toggle, shadow } from '@/pass/ui';

export default function Settings() {
  const router = useRouter();
  const { s, logout, setNotifyNear, setNotifyChat, deleteAccount, showAlert, showConfirm } = usePass();
  const tr = useT();
  const city = activeLocationLabel(s);
  const np = s.notify[s.currentUserId] ?? { near: true, chat: true, addr: null };

  // "New items near me" needs a notify address — without it there's no point to
  // measure 100 km from, so it can't be on. Show the toggle off until an address
  // is set, and prompt the user to set one when they try to enable it.
  const nearOn = np.near && !!np.addr;
  const toggleNear = () => {
    if (!np.addr) {
      showConfirm({
        title: tr('settings.needAddrTitle'),
        message: tr('settings.needAddrMsg'),
        confirmLabel: tr('settings.setAddress'),
        onConfirm: () => router.push({ pathname: '/pickmap', params: { mode: 'notify' } }),
      });
      return;
    }
    setNotifyNear(!np.near);
  };

  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  const onLogout = async () => {
    const r = await logout();
    if (r.ok) router.replace('/login');
    else showAlert(tr('sync.cantLogoutTitle'), tr('sync.cantLogoutBody'));
  };

  const confirmDelete = async () => {
    if (delText !== 'DELETE') return;
    setDelBusy(true);
    const res = await deleteAccount();
    setDelBusy(false);
    if (!res.ok) {
      setDelOpen(false);
      setDelText('');
      return showAlert('Could not delete account', res.error ?? 'Please try again.');
    }
    setDelOpen(false);
    setDelText('');
    router.replace('/login');
  };

  return (
    <Screen>
      <Header title={tr('settings.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Section title={tr('settings.location')}>
          <Pressable onPress={() => router.push('/city')} style={[row, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{tr('settings.city')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14, color: C.muted, fontWeight: '600' }}>{city}</Text>
              <Icon name="forward" size={16} color={C.muted} />
            </View>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/pickmap', params: { mode: 'notify' } })} style={row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, color: C.ink }}>{tr('settings.notifyAddress')}</Text>
              <Text style={{ fontSize: 12, color: np.addr ? C.free : C.muted, marginTop: 2 }} numberOfLines={1}>
                {np.addr ? np.addr.label : tr('settings.notifyAddressHint')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={16} color={C.accent} />
              <Icon name="forward" size={16} color={C.muted} />
            </View>
          </Pressable>
        </Section>

        <Section title={tr('settings.notifications')}>
          <View style={[row, { borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 14.5, color: C.ink }}>{tr('settings.newItemsNear')}</Text>
              <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 16 }}>
                {tr('settings.newItemsNearHint')}
              </Text>
            </View>
            <Toggle on={nearOn} onPress={toggleNear} />
          </View>
          <View style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{tr('settings.chatUpdates')}</Text>
            <Toggle on={np.chat} onPress={() => setNotifyChat(!np.chat)} />
          </View>
        </Section>

        <Section title={tr('settings.language')}>
          <Pressable onPress={() => router.push('/language')} style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{tr('settings.languageRow')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14, color: C.muted, fontWeight: '600' }}>{langInfo(s.lang).native}</Text>
              <Icon name="forward" size={16} color={C.muted} />
            </View>
          </Pressable>
        </Section>

        <Section title={tr('settings.safety')}>
          <Pressable onPress={() => router.push('/blocked')} style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{tr('settings.blockedUsers')}</Text>
            <Icon name="forward" size={18} color={C.muted} />
          </Pressable>
        </Section>

        <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
          <Pressable onPress={onLogout} style={row}>
            <Text style={{ flex: 1, fontSize: 14.5, color: C.accent, fontWeight: '700' }}>{tr('settings.logout')}</Text>
            <Icon name="forward" size={18} color={C.accent} />
          </Pressable>
        </View>

        {/* danger zone */}
        <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden', marginTop: 18 }}>
          <Pressable onPress={() => { setDelText(''); setDelOpen(true); }} style={row}>
            <Icon name="trash" size={17} color={C.dangerInk} />
            <Text style={{ flex: 1, fontSize: 14.5, color: C.dangerInk, fontWeight: '700', marginLeft: 10 }}>Delete account</Text>
            <Icon name="forward" size={18} color={C.dangerInk} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={delOpen} transparent animationType="fade" onRequestClose={() => !delBusy && setDelOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.55)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', padding: 22, ...shadow(16, 40, 0.4) }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Icon name="warning" size={26} color={C.dangerInk} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.3 }}>Delete account?</Text>
              <Text style={{ fontSize: 14, color: C.muted, lineHeight: 21, marginTop: 10 }}>
                This permanently deletes your account, all your photos, listings, chats and reviews from our servers. We keep none of your data. This cannot be undone.
              </Text>
              <Text style={{ fontSize: 13, color: C.ink, fontWeight: '600', marginTop: 16 }}>
                Type <Text style={{ color: C.dangerInk, fontWeight: '800' }}>DELETE</Text> to confirm
              </Text>
              <TextInput
                value={delText}
                onChangeText={setDelText}
                placeholder="DELETE"
                placeholderTextColor={C.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!delBusy}
                style={{ marginTop: 8, backgroundColor: C.bg, borderRadius: radius.md, borderWidth: 1.5, borderColor: delText === 'DELETE' ? C.dangerInk : C.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontWeight: '700', letterSpacing: 2, color: C.ink }}
              />
              <Pressable
                onPress={confirmDelete}
                disabled={delText !== 'DELETE' || delBusy}
                style={{ marginTop: 16, backgroundColor: delText === 'DELETE' ? C.dangerInk : C.line, borderRadius: radius.lg, borderCurve: 'continuous', paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: delText === 'DELETE' && !delBusy ? 1 : 0.6 }}>
                {delBusy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="trash" size={16} color="#fff" />}
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{delBusy ? 'Deleting…' : 'Delete my account'}</Text>
              </Pressable>
              <Btn label="Cancel" variant="ghost" onPress={() => !delBusy && setDelOpen(false)} block style={{ marginTop: 6, paddingVertical: 12 }} textStyle={{ fontSize: 14, color: C.muted }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 9, marginLeft: 4 }}>{title}</Text>
      <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

const row = { flexDirection: 'row', alignItems: 'center', padding: 15, paddingHorizontal: 16 } as const;
