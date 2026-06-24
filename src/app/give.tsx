import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName } from '@/pass/icon';
import { usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { BottomNav, Btn, CloseButton, Screen, shadow, t } from '@/pass/ui';

const BG = '#FBEFE9'; // warm tint matching the illustration backdrop

const BENEFITS: { icon: IconName; key: string }[] = [
  { icon: 'heart', key: 'give.benefit1' },
  { icon: 'smile', key: 'give.benefit2' },
  { icon: 'gift', key: 'give.benefit3' },
];

export default function Give() {
  const router = useRouter();
  const tr = useT();
  const { width } = useWindowDimensions();
  const { startPost } = usePass();

  const post = () => {
    startPost();
    router.push('/post');
  };

  const imgW = Math.min(340, Math.round(width * 0.86));

  return (
    <Screen bg={BG}>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t.h2}>{tr('give.title')}</Text>
          <CloseButton onPress={() => router.navigate('/feed')} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <Image
            source={require('../../assets/images/give-box-illustration.png')}
            style={{ width: imgW, height: imgW / 0.916, alignSelf: 'center', marginTop: 4 }}
            contentFit="contain"
          />

          <Text style={[t.h1, { fontSize: 28, marginTop: 4, textAlign: 'center', maxWidth: 300, alignSelf: 'center', lineHeight: 34 }]}>
            {tr('give.headline')} 🧡
          </Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 10, textAlign: 'center' }]}>{tr('give.heroSubtitle')}</Text>

          {/* benefit card */}
          <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', marginTop: 22, paddingVertical: 18, ...shadow(10, 26, 0.3) }}>
            {BENEFITS.map((b, i) => (
              <View key={b.key} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: C.line }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon name={b.icon} size={20} color={C.accent} />
                </View>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.ink, textAlign: 'center', lineHeight: 17 }}>{tr(b.key)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Btn icon="add" label={tr('give.postItem')} onPress={post} block style={{ borderRadius: radius.lg }} />
        <Btn icon="clipboard" label={tr('give.myListings')} variant="outline" onPress={() => router.push('/manage')} block style={{ marginTop: 11, paddingVertical: 14, borderRadius: radius.lg }} textStyle={{ fontSize: 15, color: C.accent }} />
      </View>
      <BottomNav active="give" />
    </Screen>
  );
}
