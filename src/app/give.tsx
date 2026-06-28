import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

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

  // gentle, continuous motion so the page feels alive
  const float = useSharedValue(0); // gift illustration bobs up/down
  const pulse = useSharedValue(1); // primary CTA breathes
  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    pulse.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [float, pulse]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const post = () => {
    startPost();
    router.push('/post');
  };

  const imgW = Math.min(340, Math.round(width * 0.86));

  return (
    <Screen bg={BG}>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 }}>
        <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t.h2}>{tr('give.title')}</Text>
          <CloseButton onPress={() => router.navigate('/feed')} />
        </Animated.View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
          <Animated.View entering={FadeIn.duration(550)} style={[{ alignSelf: 'center', marginTop: 4 }, floatStyle]}>
            <Image
              source={require('../../assets/images/give-box-illustration.png')}
              style={{ width: imgW, height: imgW / 0.916 }}
              contentFit="contain"
            />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(140).duration(500)} style={[t.h1, { fontSize: 28, marginTop: 4, textAlign: 'center', maxWidth: 300, alignSelf: 'center', lineHeight: 34 }]}>
            {tr('give.headline')} 🧡
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(220).duration(500)} style={[t.muted, { fontSize: 15, marginTop: 10, textAlign: 'center' }]}>
            {tr('give.heroSubtitle')}
          </Animated.Text>

          {/* benefit card — card fades in as one unit; each icon badge floats gently (staggered) */}
          <Animated.View entering={FadeInDown.delay(300).duration(550)} style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: radius.xl, borderCurve: 'continuous', marginTop: 22, paddingVertical: 18, ...shadow(10, 26, 0.3) }}>
            {BENEFITS.map((b, i) => (
              <Benefit key={b.key} icon={b.icon} label={tr(b.key)} index={i} />
            ))}
          </Animated.View>
        </ScrollView>

        <Animated.View entering={FadeInDown.delay(540).duration(500)}>
          <Animated.View style={pulseStyle}>
            <Btn icon="add" label={tr('give.postItem')} onPress={post} block style={{ borderRadius: radius.lg }} />
          </Animated.View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(620).duration(500)}>
          <Btn icon="clipboard" label={tr('give.myListings')} variant="outline" onPress={() => router.push('/manage')} block style={{ marginTop: 11, paddingVertical: 14, borderRadius: radius.lg }} textStyle={{ fontSize: 15, color: C.accent }} />
        </Animated.View>
      </View>
      <BottomNav active="give" />
    </Screen>
  );
}

// One benefit column. Only the icon badge moves — a small, slow bob, phase-offset
// per column so the three don't move in lockstep (cohesive with the floating gift).
function Benefit({ icon, label, index }: { icon: IconName; label: string; index: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      index * 320,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [y, index]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: C.line }}>
      <Animated.View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, badgeStyle]}>
        <Icon name={icon} size={20} color={C.accent} />
      </Animated.View>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.ink, textAlign: 'center', lineHeight: 17 }}>{label}</Text>
    </View>
  );
}
