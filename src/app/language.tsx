import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LANGS } from '@/pass/i18n';
import { Icon } from '@/pass/icon';
import { usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Header, Screen, t } from '@/pass/ui';

export default function Language() {
  const router = useRouter();
  const { s, patch } = usePass();
  const tr = useT();

  const choose = (code: typeof s.lang) => {
    patch({ lang: code });
    router.back();
  };

  return (
    <Screen>
      <Header title={tr('language.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 0, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={[t.small, { marginBottom: 14, marginLeft: 4 }]}>{tr('language.subtitle')}</Text>
        <View style={{ backgroundColor: C.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
          {LANGS.map((l, i) => {
            const on = s.lang === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => choose(l.code)}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', padding: 15, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 },
                  i < LANGS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.line } : null,
                ]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: on ? '800' : '600', color: on ? C.accent : C.ink }}>{l.native}</Text>
                  {l.name !== l.native ? (
                    <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{l.name}</Text>
                  ) : null}
                </View>
                {on ? <Icon name="check" size={18} color={C.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
