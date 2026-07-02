import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { INTRO_CARDS } from '@/pass/data';
import { Icon, type IconName } from '@/pass/icon';
import { useT } from '@/pass/store';
import { C, radius } from '@/pass/theme';
import { Btn, Screen, t } from '@/pass/ui';

// The pool of "free things" that rain down behind the onboarding — furniture,
// appliances, books, clothes… plus a few gifts/hearts to sell the vibe.
const FALL_ICONS: IconName[] = [
  'cat-furniture', 'cat-appliances', 'cat-electronics', 'cat-books', 'cat-kitchen',
  'cat-clothes', 'cat-decor', 'cat-baby', 'cat-other', 'gift', 'heart', 'cart',
];
const FALL_COLORS = [C.accent, C.free, '#E0A33A', C.muted];

export default function Intro() {
  const router = useRouter();
  const tr = useT();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const card = INTRO_CARDS[i] ?? INTRO_CARDS[0];

  const next = () => {
    if (i < INTRO_CARDS.length - 1) setI(i + 1);
    else router.navigate('/login'); // navigate dedupes: a fast double-tap can't push /login twice
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* depth: soft accent washes top-right + bottom-left */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(217,74,47,0.06)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -90, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(46,158,91,0.05)' }} />

      {/* card 0 only: ambient falling free-stuff, behind everything */}
      {i === 0 ? <FallingField width={width} height={height} /> : null}

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.navigate('/login')} hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted }}>{tr('intro.skip')}</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
          {/* free badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentSoft, paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, marginBottom: 26 }}>
            <Icon name="gift" size={14} color={C.accent} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.accent, letterSpacing: 0.2 }}>{tr('intro.freeBadge')}</Text>
          </View>

          {i === 0 ? (
            <FindIllustration width={width} />
          ) : (
            <GiveHandoff width={width} tint={card.tint} />
          )}

          <Text style={[t.h1, { fontSize: 27, marginTop: 34, textAlign: 'center', maxWidth: 290, lineHeight: 33 }]}>
            {card.title}
          </Text>
          <Text style={[t.muted, { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 300, lineHeight: 23 }]}>
            {card.body}
          </Text>
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {INTRO_CARDS.map((_, idx) => (
            <View
              key={idx}
              style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === idx ? C.accent : C.toggleOff }}
            />
          ))}
        </View>
        <Btn label={card.cta} onPress={next} block style={{ borderRadius: radius.lg }} />
      </View>
    </Screen>
  );
}

// ---- find: 3D "box of free stuff" illustration, gently floating ----

const FIND_IMG = require('../../assets/images/find-illustration.png');
const FIND_W = 431;
const FIND_H = 409;

function FindIllustration({ width }: { width: number }) {
  const Dw = Math.min(300, Math.round(width * 0.76));
  const Dh = Dw * (FIND_H / FIND_W);
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [f]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -9 * f.value }] }));
  return <Animated.Image source={FIND_IMG} resizeMode="contain" style={[{ width: Dw, height: Dh }, style]} />;
}

// ---- give: gift hand-off animation ----
// Real illustration sliced into two layers (empty hand on top, gift-holding hand
// below). They gently reach toward each other and part, with a spark at the
// closest point — reads as one giving, one receiving.

const HAND_TOP = require('../../assets/images/give-hand-top.png');
const HAND_BOTTOM = require('../../assets/images/give-hand-bottom.png');
// source slice geometry (px): full 374×740, top 374×318, bottom 374×422
const SRC_W = 374;
const TOP_H = 318;
const BOT_H = 422;

function GiveHandoff({ width, tint }: { width: number; tint: string }) {
  const Dw = Math.min(230, Math.round(width * 0.6));
  const sc = Dw / SRC_W;
  const topH = TOP_H * sc;
  const botH = BOT_H * sc;
  const Dh = topH + botH;
  const gap = Dh * 0.055;

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);

  // p:0 = apart, p:1 = met. Top hand reaches down, gift hand lifts up.
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -gap * (1 - p.value) }] }));
  const botStyle = useAnimatedStyle(() => ({ transform: [{ translateY: gap * (1 - p.value) }] }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.55, 1], [0, 0.95]),
    transform: [{ scale: interpolate(p.value, [0.55, 1], [0.4, 1.05]) }],
  }));

  return (
    <View style={{ width: Dw, height: Dh, alignItems: 'center', justifyContent: 'center' }}>
      {/* soft grounding glow behind the meeting point */}
      <View style={{ position: 'absolute', top: topH - Dw * 0.48, width: Dw * 0.96, height: Dw * 0.96, borderRadius: Dw, backgroundColor: tint, opacity: 0.5 }} />

      <Animated.Image source={HAND_TOP} resizeMode="contain" style={[{ position: 'absolute', top: 0, width: Dw, height: topH }, topStyle]} />
      <Animated.Image source={HAND_BOTTOM} resizeMode="contain" style={[{ position: 'absolute', top: topH, width: Dw, height: botH }, botStyle]} />

      <Animated.View style={[{ position: 'absolute', top: topH - Dw * 0.13, left: 0, right: 0, alignItems: 'center' }, sparkStyle]}>
        <Icon name="celebrate" size={Dw * 0.2} color="#E0A33A" />
      </Animated.View>
    </View>
  );
}

// ---- falling "free stuff" animation ----

function FallingField({ width, height }: { width: number; height: number }) {
  // build a stable spread of items once per viewport size
  const items = useMemo(
    () =>
      Array.from({ length: 16 }, (_, idx) => {
        const size = 22 + Math.random() * 26;
        return {
          id: idx,
          icon: FALL_ICONS[Math.floor(Math.random() * FALL_ICONS.length)],
          color: FALL_COLORS[Math.floor(Math.random() * FALL_COLORS.length)],
          size,
          x: Math.random() * (width - size - 20) + 10,
          dur: 5200 + Math.random() * 4400,
          delay: Math.random() * 7000,
          sway: 12 + Math.random() * 30,
          spin: (Math.random() - 0.5) * 1.3,
          maxOp: 0.16 + Math.random() * 0.16,
        };
      }),
    [width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it) => (
        <FallingItem key={it.id} {...it} height={height} />
      ))}
    </View>
  );
}

function FallingItem({
  icon, color, size, x, dur, delay, sway, spin, maxOp, height,
}: {
  icon: IconName; color: string; size: number; x: number; dur: number; delay: number; sway: number; spin: number; maxOp: number; height: number;
}) {
  const p = useSharedValue(0);

  // linear loop; opacity fades in/out so the wrap-around is invisible
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false));
  }, [p, delay, dur]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -size + p.value * (height + size * 2) },
      { translateX: Math.sin(p.value * Math.PI * 2) * sway },
      { rotate: `${spin * 360 * p.value}deg` },
    ],
    opacity: interpolate(p.value, [0, 0.12, 0.85, 1], [0, maxOp, maxOp, 0]),
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: 0 }, style]}>
      <Icon name={icon} size={size} color={color} />
    </Animated.View>
  );
}
