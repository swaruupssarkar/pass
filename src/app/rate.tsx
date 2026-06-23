import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { RATE_TAGS } from '@/pass/data';
import { Icon } from '@/pass/icon';
import { profileOf, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Pill, Screen, t } from '@/pass/ui';

export default function Rate() {
  const router = useRouter();
  const tr = useT();
  const { s, patch, toggleRateTag, submitRate } = usePass();
  const giver = s.rateGiverId ? profileOf(s, s.rateGiverId) : null;

  const submit = () => {
    if (s.rating === 0) return;
    submitRate();
    router.replace('/feed');
  };

  const skip = () => router.replace('/feed');

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="celebrate" size={38} color={C.accent} />
          </View>
          <Text style={[t.h2, { fontSize: 23, marginTop: 20 }]}>{tr('rate.title')}</Text>
          <Text style={[t.muted, { fontSize: 14.5, marginTop: 10, textAlign: 'center', maxWidth: 280, lineHeight: 21 }]}>
            {tr('rate.prompt', { name: giver?.name ?? tr('rate.theGiver') })}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => patch({ rating: n })} hitSlop={4}>
                <Icon name={n <= s.rating ? 'star' : 'star-outline'} size={38} color={C.star} />
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 24 }}>
            {RATE_TAGS.map((tag) => (
              <Pill key={tag} label={tr('rate.tag.' + tag)} selected={s.rateTags.includes(tag)} onPress={() => toggleRateTag(tag)} />
            ))}
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 8 }}>
              {tr('rate.writeReview')} <Text style={{ color: C.muted, fontWeight: '500' }}>{tr('rate.optional')}</Text>
            </Text>
            <TextInput
              value={s.reviewDraft}
              onChangeText={(reviewDraft) => patch({ reviewDraft })}
              placeholder={tr('rate.reviewPlaceholder', { name: giver?.name ?? tr('rate.them') })}
              placeholderTextColor={C.muted}
              multiline
              style={{ minHeight: 90, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: radius.md, padding: 14, fontSize: 14, color: C.ink, textAlignVertical: 'top' }}
            />
          </View>
        </ScrollView>
        <Btn
          label={tr('rate.submit')}
          onPress={s.rating > 0 ? submit : undefined}
          block
          style={s.rating === 0 && { opacity: 0.4 }}
        />
        <Btn label={tr('rate.maybeLater')} onPress={skip} variant="ghost" block style={{ marginTop: 4 }} />
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
