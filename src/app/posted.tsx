import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, Vibration, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from '@/pass/icon';
import { myListings, usePass, useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, shadow } from '@/pass/ui';

const HERO_IMG = require('../../assets/images/celebrate-gift.png');

const PALETTE = ['#FA6023', '#FFC56B', '#34A853', '#EA4C89', '#4C9AFF', '#FF7A45'];
const PRAISE = [1, 2, 3, 4];

// One falling confetti piece. Each picks its own random path/colour once (useRef)
// so re-renders don't reshuffle it; runs a single fall on mount.
function ConfettiPiece({ width, height }: { width: number; height: number }) {
  const cfg = useRef({
    x: Math.random() * width,
    size: 7 + Math.random() * 8,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    delay: Math.random() * 500,
    dur: 2300 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
    round: Math.random() < 0.5,
  }).current;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(cfg.delay, withTiming(1, { duration: cfg.dur, easing: Easing.linear }));
  }, [p, cfg.delay, cfg.dur]);
  const st = useAnimatedStyle(() => ({
    transform: [
      { translateX: cfg.drift * p.value },
      { translateY: -40 + (height + 80) * p.value },
      { rotate: `${cfg.spin * p.value}deg` },
    ],
    opacity: interpolate(p.value, [0, 0.05, 0.85, 1], [0, 1, 1, 0]),
  }));
  return <Animated.View style={[{ position: 'absolute', left: cfg.x, top: 0, width: cfg.size, height: cfg.size, borderRadius: cfg.round ? cfg.size / 2 : 2, backgroundColor: cfg.color }, st]} />;
}

function Confetti() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 40 }).map((_, i) => (
        <ConfettiPiece key={i} width={width} height={height} />
      ))}
    </View>
  );
}

export default function Posted() {
  const router = useRouter();
  const tr = useT();
  const { s, startPost } = usePass();
  const count = myListings(s).length;
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);

  const { width } = useWindowDimensions();
  const heroW = Math.min(290, width * 0.74);

  const scale = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 120 }));
    float.value = withDelay(600, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true));
    Vibration.vibrate(40); // a little congratulatory buzz
  }, [scale, float]);
  const heroSt = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: interpolate(float.value, [0, 1], [-7, 7]) }],
  }));

  const again = () => {
    startPost();
    router.replace('/post');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Confetti />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
        <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, heroSt]}>
          <Image source={HERO_IMG} style={{ width: heroW, height: heroW }} contentFit="contain" />
        </Animated.View>

        {count > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14, ...shadow(6, 14, 0.2) }}>
            <Icon name="heart" size={14} color={C.accent} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>
              {count} {tr('posted.shared')}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 25, fontWeight: '800', color: C.ink, textAlign: 'center', marginTop: 20, lineHeight: 32, letterSpacing: -0.4 }}>{tr(`posted.praise${praise}`)}</Text>
        <Text style={{ fontSize: 15, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 }}>{tr('posted.subtitle')}</Text>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 28, gap: 11 }}>
        <Btn icon="add" label={tr('posted.again')} onPress={again} block style={{ borderRadius: radius.lg }} />
        <Btn icon="check" label={tr('posted.done')} variant="outline" onPress={() => router.replace('/feed')} block style={{ paddingVertical: 14, borderRadius: radius.lg }} textStyle={{ fontSize: 15, color: C.accent }} />
      </View>
    </Screen>
  );
}
