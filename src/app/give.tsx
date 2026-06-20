import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/pass/icon';
import { myListings, usePass } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, BottomNav, CloseButton, Screen, t } from '@/pass/ui';

const LINES = [
  'One person’s clutter is another’s treasure.',
  'Give once, smile twice.',
  'Your spare chair could be someone’s first.',
  'Less landfill, more love.',
  'Kindness travels fast in the neighbourhood.',
];

export default function Give() {
  const router = useRouter();
  const { s, startPost } = usePass();
  const given = myListings(s).filter((l) => l.taken).length;
  const [line, setLine] = useState(0);

  const float = useSharedValue(0);
  const pulse = useSharedValue(0);
  const cta = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
    cta.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
    const id = setInterval(() => setLine((p) => (p + 1) % LINES.length), 3000);
    return () => clearInterval(id);
  }, [cta, float, pulse]);

  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * float.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.7 }], opacity: 0.3 * (1 - pulse.value) }));
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + cta.value * 0.02 }] }));

  const post = () => {
    startPost();
    router.push('/post');
  };

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={t.h2}>Give away</Text>
          <CloseButton onPress={() => router.navigate('/feed')} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* animated hero */}
          <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: C.accent }, ringStyle]} />
            <Animated.View style={[{ width: 140, height: 140, borderRadius: 44, borderCurve: 'continuous', backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }, heroStyle]}>
              <Icon name="gift" size={64} color={C.accent} />
            </Animated.View>
          </View>

          <Animated.Text entering={FadeInDown.delay(120).springify()} style={[t.h1, { fontSize: 27, marginTop: 30, textAlign: 'center', maxWidth: 290, lineHeight: 32 }]}>
            Turn clutter into kindness
          </Animated.Text>

          {/* rotating motivational line */}
          <View style={{ height: 44, justifyContent: 'center', marginTop: 10 }}>
            <Animated.Text key={line} entering={FadeIn.duration(500)} style={[t.muted, { fontSize: 15, textAlign: 'center', maxWidth: 300, lineHeight: 22 }]}>
              {LINES[line]}
            </Animated.Text>
          </View>

          {/* impact chip */}
          <Animated.View entering={FadeIn.delay(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, marginTop: 18 }}>
            <Icon name="heart" size={14} color={C.accent} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>
              {given > 0 ? `You've gifted ${given} item${given > 1 ? 's' : ''} so far` : 'Be the first to give today'}
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(200)} style={ctaStyle}>
          <Btn icon="add" label="Post an item" onPress={post} block />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300)} style={{ flexDirection: 'row', gap: 11, marginTop: 11 }}>
          <Btn icon="clipboard" label="My listings" variant="outline" onPress={() => router.push('/manage')} style={{ flex: 1, paddingVertical: 13 }} textStyle={{ fontSize: 14 }} />
          <Btn icon="star" label="My impact" variant="outline" onPress={() => router.push('/impact')} style={{ flex: 1, paddingVertical: 13 }} textStyle={{ fontSize: 14 }} />
        </Animated.View>
      </View>
      <BottomNav active="give" />
    </Screen>
  );
}
