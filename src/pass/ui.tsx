import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Icon, type IconName } from '@/pass/icon';
import { capture } from '@/pass/analytics';
import { isExpoGo } from '@/pass/config';
import { isPushGranted, registerForPush } from '@/pass/push';
import { hasUnreadChats, usePass, userName, useT } from '@/pass/store';
import { C, hatch, radius } from '@/pass/theme';

// ---------- screen scaffold ----------

export function Screen({
  children,
  bg = C.bg,
  edges = ['top'],
  style,
}: {
  children: React.ReactNode;
  bg?: string;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  // Use insets from context (available synchronously) instead of SafeAreaView,
  // which measures after first paint and makes content "bounce" down on mount —
  // very visible with the fade screen transition.
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return <View style={[{ flex: 1, backgroundColor: bg }, pad, style]}>{children}</View>;
}

// ---------- text ----------

export const t = StyleSheet.create({
  h1: { fontSize: 25, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: '800', color: C.ink },
  title: { fontSize: 16, fontWeight: '800', color: C.ink },
  body: { fontSize: 15, color: C.ink, lineHeight: 22 },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  small: { fontSize: 12.5, color: C.muted, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.3 },
});

// ---------- placeholder photo (diagonal hatch over a tint) ----------

export const Hatch = memo(function Hatch({ gap = 16 }: { gap?: number }) {
  return <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: hatch(gap) } as unknown as ViewStyle]} />;
});

export function PhotoTile({
  tint,
  caption,
  uri,
  source,
  icon,
  iconSize = 40,
  gap = 16,
  style,
  children,
}: {
  tint: string;
  caption?: string;
  /** real photo to show; falls back to the tinted placeholder when absent */
  uri?: string;
  /** bundled local image (require(...)) — takes precedence over uri */
  source?: number;
  /** branded placeholder icon shown (centered) when there is no photo */
  icon?: IconName;
  iconSize?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[{ backgroundColor: tint, overflow: 'hidden' }, style]}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : icon ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name={icon} size={iconSize} color={C.accent} />
        </View>
      ) : (
        <>
          <Hatch gap={gap} />
          {caption ? (
            <View style={[StyleSheet.absoluteFill, { paddingHorizontal: 4 }]}>
              <Text numberOfLines={1} style={styles.caption}>
                {caption}
              </Text>
            </View>
          ) : null}
        </>
      )}
      {children}
    </View>
  );
}

// ---------- gradient helper (CSS gradient on New Arch) ----------

// ---------- buttons ----------

type BtnVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'accentOutline';

export function Btn({
  label,
  onPress,
  variant = 'primary',
  block,
  icon,
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  block?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const v = BTN[variant];
  const fg = (v.text.color as string) ?? C.ink;
  const size = (StyleSheet.flatten([styles.btnText, textStyle]).fontSize as number) ?? 16;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        v.box,
        block && { alignSelf: 'stretch' },
        pressed && { opacity: 0.6 },
        style,
      ]}>
      {icon ? <Icon name={icon} size={size + 2} color={fg} /> : null}
      <Text style={[styles.btnText, v.text, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const BTN: Record<BtnVariant, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: C.accent }, text: { color: '#fff' } },
  dark: { box: { backgroundColor: C.ink }, text: { color: '#fff' } },
  outline: { box: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line }, text: { color: C.ink } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: C.muted } },
  accentOutline: {
    box: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.accent },
    text: { color: C.accent },
  },
};

// ---------- pill / tag ----------

export function Pill({
  label,
  selected,
  onPress,
  tone = 'plain',
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'plain' | 'accent' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = selected ? C.accent : tone === 'soft' ? C.bg : C.surface;
  const fg = selected ? '#fff' : tone === 'accent' ? C.accent : C.ink;
  const bd = selected ? C.accent : C.line;
  return (
    <Pressable
      onPress={onPress}
      style={[
        { backgroundColor: bg, borderWidth: 1, borderColor: bd, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 15 },
        style,
      ]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function FreeTag({ style, small }: { style?: StyleProp<ViewStyle>; small?: boolean }) {
  return (
    <View
      style={[
        { backgroundColor: C.free, borderRadius: radius.pill, paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 8 : 11 },
        style,
      ]}>
      <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: small ? 10 : 11, letterSpacing: 0.4 }}>
        FREE
      </Text>
    </View>
  );
}

// ---------- avatar (initials) ----------

export function Avatar({
  name,
  uri,
  size = 48,
  tint = C.accentSoft,
  color = C.accent,
  square,
  style,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  tint?: string;
  color?: string;
  square?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const borderRadius = square ? size * 0.3 : size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius }, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        transition={120}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.4 }}>{(name || '?')[0]}</Text>
    </View>
  );
}

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.free,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name="check" size={size * 0.7} color="#fff" />
    </View>
  );
}

// ---------- header (back + title) ----------

export function Header({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack ?? (() => router.back())} style={styles.backBtn}>
        <Icon name="back" size={22} color={C.ink} />
      </Pressable>
      <Text style={[t.h3, { flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

// ---------- circular close button ----------

export function CloseButton({ onPress, size = 38 }: { onPress?: () => void; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name="close" size={size * 0.5} color={C.ink} />
    </Pressable>
  );
}

// ---------- toggle switch ----------

export function Toggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 46, height: 27, borderRadius: radius.pill, backgroundColor: on ? C.accent : C.toggleOff }}>
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: 11,
          backgroundColor: '#fff',
        }}
      />
    </Pressable>
  );
}

// ---------- safety note (warm warning box) ----------

export function SafetyNote({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: danger ? C.dangerBg : C.warnBg,
        borderWidth: 1,
        borderColor: danger ? C.dangerBorder : C.warnBorder,
        borderRadius: radius.md,
        padding: 13,
      }}>
      <Icon name="warning" size={16} color={danger ? C.dangerInk : C.warnInk} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: danger ? C.dangerInk : C.warnInk }}>
        {text}
      </Text>
    </View>
  );
}

// ---------- animated onboarding hero ----------
// A softly floating rounded-square disc with a centered icon and a pulsing ring
// behind it. Optional notification-style badge. Used on the onboarding screens
// so the hero feels alive.

export function AnimatedIconHero({
  icon,
  disc = 132,
  iconSize = 54,
  tint = C.accentSoft,
  badge,
}: {
  icon: IconName;
  disc?: number;
  iconSize?: number;
  tint?: string;
  badge?: string;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [float, pulse]);

  const discStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.55 }], opacity: 0.22 * (1 - pulse.value) }));

  const r = disc * 0.32;
  return (
    <View style={{ width: disc + 64, height: disc + 64, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: disc, height: disc, borderRadius: r, borderCurve: 'continuous', backgroundColor: C.accent }, ringStyle]} />
      <Animated.View style={[{ width: disc, height: disc, borderRadius: r, borderCurve: 'continuous', backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }, discStyle]}>
        <Icon name={icon} size={iconSize} color={C.accent} />
        {badge ? (
          <View style={{ position: 'absolute', top: disc * 0.18, right: disc * 0.2, minWidth: 24, height: 24, paddingHorizontal: 5, borderRadius: 12, backgroundColor: C.accent, borderWidth: 2.5, borderColor: tint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ---------- animated empty state ----------
// Shared blank-screen placeholder: a softly floating icon inside a pulsing
// ring, plus optional title/body/CTA. Used on every "nothing here yet" screen
// so empties feel alive instead of static.

export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  ctaIcon,
  onCta,
  compact,
  brand,
}: {
  icon: IconName;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaIcon?: IconName;
  onCta?: () => void;
  compact?: boolean;
  /** Use the branded heart→Daata-logo loop instead of the plain icon disc. */
  brand?: boolean;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [float, pulse]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * float.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.6 }], opacity: 0.26 * (1 - pulse.value) }));

  const disc = compact ? 70 : 84;
  return (
    <View style={{ flex: 1, minHeight: compact ? 260 : 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingVertical: compact ? 40 : 50 }}>
      {brand ? (
        <DaataBrandHero size={compact ? 104 : 132} />
      ) : (
        <View style={{ width: disc + 36, height: disc + 36, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: disc, height: disc, borderRadius: disc / 2, backgroundColor: C.accent }, ringStyle]} />
          <Animated.View style={[{ width: disc, height: disc, borderRadius: disc / 2, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }, iconStyle]}>
            <Icon name={icon} size={compact ? 30 : 34} color={C.accent} />
          </Animated.View>
        </View>
      )}
      <Animated.Text entering={FadeInDown.delay(80).springify()} style={{ marginTop: 16, textAlign: 'center', fontSize: 15, fontWeight: '600', color: C.muted }}>{title}</Animated.Text>
      {body ? (
        <Animated.Text entering={FadeInDown.delay(150)} style={[t.small, { marginTop: 6, textAlign: 'center', maxWidth: 290, opacity: 0.85 }]}>{body}</Animated.Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Animated.View entering={FadeInDown.delay(220)} style={{ marginTop: 18 }}>
          <Btn icon={ctaIcon} label={ctaLabel} onPress={onCta} style={{ paddingVertical: 12, paddingHorizontal: 22 }} textStyle={{ fontSize: 14 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------- branded empty-state animation ----------
// One 4s loop: a heart bounces in, pulses twice, cross-fades into the Daata
// logo, three free items float up around it with a sparkle, the logo breathes,
// then everything fades and the loop restarts. Soft easing throughout.

const BRAND_ORANGE = '#FA6023';
const CLAMP = Extrapolation.CLAMP;

function DaataBrandHero({ size = 132 }: { size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [p]);

  // heart: bounce in (0–0.2), pulse twice (0.2–0.4), shrink+fade into logo (0.4–0.55)
  const heart = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.06, 0.4, 0.55], [0, 1, 1, 0], CLAMP),
    transform: [{ scale: interpolate(p.value, [0, 0.12, 0.2, 0.25, 0.3, 0.35, 0.4, 0.55], [0, 1.12, 1, 1.15, 1, 1.15, 1, 0.5], CLAMP) }],
  }));
  // logo: cross-fade in (0.42–0.55), breathe (0.75–0.88), fade out (0.88–1)
  const logo = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.42, 0.55, 0.88, 1], [0, 1, 1, 0], CLAMP),
    transform: [{ scale: interpolate(p.value, [0.42, 0.55, 0.75, 0.815, 0.88], [0.6, 1, 1, 1.05, 1], CLAMP) }],
  }));

  const box = size * 1.9;
  const r = size * 0.6;
  const sparks = [0, 1, 2, 3, 4].map((i) => ({ x: Math.cos((i / 5) * 2 * Math.PI) * r, y: Math.sin((i / 5) * 2 * Math.PI) * r, start: 0.5 + i * 0.02 }));
  const logoSize = size * 0.78;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {sparks.map((sp, i) => (
        <Spark key={i} p={p} x={sp.x} y={sp.y} start={sp.start} />
      ))}

      <Animated.View style={[{ position: 'absolute' }, logo]}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: logoSize, height: logoSize, borderRadius: logoSize * 0.26 }} contentFit="contain" />
      </Animated.View>

      <Animated.View style={[{ position: 'absolute' }, heart]}>
        <Icon name="heart" size={size * 0.5} color={BRAND_ORANGE} />
      </Animated.View>

      <FloatItem p={p} dx={-size * 0.66} y0={size * 0.04} y1={-size * 0.22} start={0.56}>
        <Icon name="cat-furniture" size={size * 0.22} color={BRAND_ORANGE} />
      </FloatItem>
      <FloatItem p={p} dx={0} y0={-size * 0.36} y1={-size * 0.66} start={0.6}>
        <MaterialCommunityIcons name="teddy-bear" size={size * 0.23} color={BRAND_ORANGE} />
      </FloatItem>
      <FloatItem p={p} dx={size * 0.66} y0={size * 0.04} y1={-size * 0.22} start={0.64}>
        <Icon name="cat-books" size={size * 0.22} color={BRAND_ORANGE} />
      </FloatItem>
    </View>
  );
}

// A free item that rises (y0→y1) out around the logo and fades, trailing a few
// dotted breadcrumbs beneath it — so it reads as floating up, not stuck on the logo.
function FloatItem({ p, dx, y0, y1, start, children }: { p: { value: number }; dx: number; y0: number; y1: number; start: number; children: React.ReactNode }) {
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [start, start + 0.07, start + 0.18, start + 0.26], [0, 1, 1, 0], CLAMP),
    transform: [{ translateX: dx }, { translateY: interpolate(p.value, [start, start + 0.26], [y0, y1], CLAMP) }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', alignItems: 'center' }, st]}>
      {children}
      <View style={{ position: 'absolute', top: '100%', alignItems: 'center', gap: 5, paddingTop: 6 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: BRAND_ORANGE, opacity: 0.4 - i * 0.11 }} />
        ))}
      </View>
    </Animated.View>
  );
}

function Spark({ p, x, y, start }: { p: { value: number }; x: number; y: number; start: number }) {
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [start, start + 0.06, start + 0.16], [0, 1, 0], CLAMP),
    transform: [{ translateX: x }, { translateY: y }, { scale: interpolate(p.value, [start, start + 0.08, start + 0.16], [0.3, 1, 0.4], CLAMP) }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND_ORANGE }, st]} />;
}

// ---------- review card ----------

export function ReviewCard({
  rating,
  tags,
  text,
  authorName,
  authorUri,
  date,
  product,
  onAuthorPress,
}: {
  rating: number;
  tags: string[];
  text: string;
  authorName: string;
  authorUri?: string | null;
  date: string;
  /** the listing this review is for */
  product?: string;
  onAuthorPress?: () => void;
}) {
  const tr = useT();
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 18, borderCurve: 'continuous', padding: 16, ...shadow(8, 20, 0.35) }}>
      {/* rating + decorative quote */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Icon key={n} name={n <= rating ? 'star' : 'star-outline'} size={16} color={C.star} />
          ))}
        </View>
        <Text style={{ fontSize: 42, lineHeight: 34, color: C.accent, opacity: 0.18, fontWeight: '900' }}>”</Text>
      </View>

      {/* which product */}
      {product ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Icon name="cart" size={13} color={C.muted} />
          <Text style={{ flex: 1, fontSize: 12, color: C.muted, fontWeight: '600' }} numberOfLines={1}>{tr('review.forProduct', { title: product })}</Text>
        </View>
      ) : null}

      {/* tags as chips */}
      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {tags.map((tag) => (
            <View key={tag} style={{ backgroundColor: C.accentSoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 11 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.accent }}>{tr('rate.tag.' + tag)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* review text — hero, with accent bar */}
      {text ? (
        <View style={{ flexDirection: 'row', gap: 11, marginTop: tags.length > 0 || product ? 12 : 14 }}>
          <View style={{ width: 3, borderRadius: 2, backgroundColor: C.accentSoft }} />
          <Text style={{ flex: 1, fontSize: 15, color: C.ink, lineHeight: 22, fontWeight: '500' }}>{text}</Text>
        </View>
      ) : null}

      {/* reviewer footer */}
      <Pressable onPress={onAuthorPress} disabled={!onAuthorPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line, opacity: pressed && onAuthorPress ? 0.7 : 1 })}>
        <Avatar name={authorName} uri={authorUri} size={34} color={C.ink} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.ink }} numberOfLines={1}>{authorName}</Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{date}</Text>
        </View>
        {onAuthorPress ? <Icon name="forward" size={18} color={C.muted} /> : null}
      </Pressable>
    </View>
  );
}

// ---------- bottom navigation ----------

type NavKey = 'home' | 'saved' | 'give' | 'inbox' | 'profile';
const NAV_ROUTE: Record<NavKey, '/feed' | '/saved' | '/give' | '/inbox' | '/profile'> = {
  home: '/feed',
  saved: '/saved',
  give: '/give',
  inbox: '/inbox',
  profile: '/profile',
};

export function BottomNav({ active }: { active: NavKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const { s } = usePass();
  const unreadChats = hasUnreadChats(s);
  const go = (k: NavKey) => () => router.navigate(NAV_ROUTE[k]);
  const col = (k: NavKey) => (active === k ? C.accent : '#B6ADA2');
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <NavItem icon={active === 'home' ? 'home' : 'home-outline'} label={tr('nav.home')} color={col('home')} onPress={go('home')} />
      <NavItem icon={active === 'saved' ? 'heart' : 'heart-outline'} label={tr('nav.saved')} color={col('saved')} onPress={go('saved')} />
      <Pressable onPress={go('give')} style={({ pressed }) => [styles.fabWrap, pressed && { opacity: 0.6 }]}>
        <View style={styles.fab}>
          <Icon name="add" size={32} color="#fff" />
        </View>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.accent, marginTop: 5 }}>{tr('nav.give')}</Text>
      </Pressable>
      <NavItem icon={active === 'inbox' ? 'chat' : 'chat-outline'} label={tr('nav.chats')} color={col('inbox')} onPress={go('inbox')} dot={unreadChats} />
      <NavItem icon={active === 'profile' ? 'person' : 'person-outline'} label={tr('nav.profile')} color={col('profile')} onPress={go('profile')} />
    </View>
  );
}

function NavItem({ icon, label, color, onPress, dot }: { icon: IconName; label: string; color: string; onPress: () => void; dot?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.5 }]}>
      <View>
        <Icon name={icon} size={22} color={color} />
        {dot ? (
          <View style={{ position: 'absolute', top: -3, right: -5, width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.surface }} />
        ) : null}
      </View>
      <Text style={{ fontSize: 10, fontWeight: '700', color }}>{label}</Text>
    </Pressable>
  );
}

// ---------- branded dialog (replaces native Alert) ----------

export function PassDialog() {
  const { s, closeDialog } = usePass();
  const d = s.dialog;
  if (!d) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
      <View style={{ width: '100%', maxWidth: 360, backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', padding: 22, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.55)' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: -0.3 }}>{d.title}</Text>
        {d.message ? <Text style={{ fontSize: 14, color: C.muted, lineHeight: 21, marginTop: 8 }}>{d.message}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          {d.actions.map((a, i) => {
            const bg = a.kind === 'primary' ? C.accent : a.kind === 'destructive' ? C.dangerBg : C.surface;
            const fg = a.kind === 'primary' ? '#fff' : a.kind === 'destructive' ? C.dangerInk : C.ink;
            return (
              <Pressable
                key={i}
                onPress={() => {
                  closeDialog();
                  a.onPress?.();
                }}
                style={({ pressed }) => ({
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  backgroundColor: bg,
                  borderWidth: a.kind === 'cancel' ? 1.5 : 0,
                  borderColor: C.line,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <Text style={{ fontSize: 14.5, fontWeight: '800', color: fg }}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Blocking overlay shown while logout drains pending writes to the database.
 *  Non-dismissable: the user can't leave until everything is synced (or logout
 *  refuses because they're offline). */
export function SyncOverlay() {
  const tr = useT();
  const { s } = usePass();
  if (!s.syncing) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
      <View style={{ alignItems: 'center', backgroundColor: C.surface, borderRadius: 22, borderCurve: 'continuous', paddingVertical: 30, paddingHorizontal: 34, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.55)' }}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 18, letterSpacing: -0.2 }}>{tr('sync.title')}</Text>
        <Text style={{ fontSize: 13.5, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 19, maxWidth: 220 }}>{tr('sync.body')}</Text>
      </View>
    </View>
  );
}

// Daily "turn on notifications" nudge for signed-in users who haven't granted it.
// Fires 5s after the app opens / returns to foreground, at most once per calendar
// day (persisted). "Enable" runs the OS prompt + registers the token; if the user
// has permanently denied, it sends them to system Settings. Skipped in Expo Go.
export function NotifyNudge() {
  const tr = useT();
  const { s, showConfirm, recordNotifyNudge } = usePass();
  const me = s.currentUserId;
  const onboarded = s.onboarded;
  const lastDate = s.notifyNudgeDate;
  useEffect(() => {
    // Only nudge onboarded users. A first-time user has a session right after OTP
    // verify but is still in onboarding — they must NOT be nudged. On finishing
    // onboarding, setCity stamps notifyNudgeDate=today so the first nudge is next day.
    if (isExpoGo || !me || !onboarded) return;
    const today = () => new Date().toISOString().slice(0, 10);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const maybeNudge = async () => {
      if (cancelled || timer || lastDate === today()) return; // already pending / shown today
      if (await isPushGranted()) return; // already enabled → never nudge
      if (cancelled || lastDate === today()) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (cancelled) return;
        recordNotifyNudge(); // mark shown today (once/day)
        capture('notify_nudge_shown');
        showConfirm({
          title: tr('notifyNudge.title'),
          message: tr('notifyNudge.body'),
          confirmLabel: tr('notifyNudge.enable'),
          cancelLabel: tr('notifyNudge.later'),
          onConfirm: async () => {
            const token = await registerForPush(me);
            if (!token) void Linking.openSettings(); // denied / can't re-ask → Settings
          },
        });
      }, 5000);
    };
    void maybeNudge();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void maybeNudge();
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [me, onboarded, lastDate, tr, showConfirm, recordNotifyNudge]);
  return null;
}

const CLIENT_REASONS = ['cancel.reason.money', 'cancel.reason.privacy', 'cancel.reason.personal', 'cancel.reason.spam', 'cancel.reason.changedMind', 'cancel.reason.other'];
const OWNER_REASONS = ['cancel.reason.scam', 'cancel.reason.money', 'cancel.reason.spam', 'cancel.reason.noshow', 'cancel.reason.unavailable', 'cancel.reason.other'];
// reasons that imply a bad actor -> offer to block them after cancelling
const SAFETY_REASONS = new Set(['cancel.reason.money', 'cancel.reason.privacy', 'cancel.reason.personal', 'cancel.reason.spam', 'cancel.reason.scam']);

/** Bottom sheet to pick a reason when cancelling an accepted request. */
export function CancelReasonSheet() {
  const tr = useT();
  const { s, cancelRequest, closeCancelReason, blockUser, showConfirm } = usePass();
  const insets = useSafeAreaInsets();
  const target = s.cancelTarget;
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState('');

  useEffect(() => {
    setPicked(null);
    setOther('');
  }, [target?.requestId]);

  if (!target) return null;
  const reasons = target.role === 'owner' ? OWNER_REASONS : CLIENT_REASONS;
  const isOther = picked === 'cancel.reason.other';
  const canConfirm = !!picked && (!isOther || other.trim().length > 0);

  const req = s.requests.find((r) => r.id === target.requestId);
  const otherId = req ? (s.currentUserId === req.fromUserId ? req.toUserId : req.fromUserId) : null;

  const confirm = () => {
    if (!picked) return;
    const reasonText = isOther ? other.trim() : tr(picked);
    const safety = SAFETY_REASONS.has(picked);
    cancelRequest(target.requestId, reasonText);
    if (safety && otherId) {
      showConfirm({
        title: tr('cancel.blockToo', { name: userName(s, otherId) }),
        message: tr('thread.blockMsg'),
        confirmLabel: tr('thread.block'),
        destructive: true,
        onConfirm: () => blockUser(otherId),
      });
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,17,17,0.45)', justifyContent: 'flex-end' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={closeCancelReason} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous', padding: 22, paddingBottom: insets.bottom + 18 }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 }} />
        <Text style={{ fontSize: 19, fontWeight: '800', color: C.ink, letterSpacing: -0.3 }}>{tr('cancel.title')}</Text>
        <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 20, marginTop: 6 }}>{tr('cancel.subtitle')}</Text>
        <View style={{ gap: 9, marginTop: 18 }}>
          {reasons.map((k) => {
            const on = picked === k;
            return (
              <Pressable
                key={k}
                onPress={() => setPicked(k)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accentSoft : C.surface, borderRadius: radius.md, borderCurve: 'continuous', paddingVertical: 13, paddingHorizontal: 14 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.accent : C.line, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} /> : null}
                </View>
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: on ? '700' : '600', color: C.ink }}>{tr(k)}</Text>
              </Pressable>
            );
          })}
        </View>
        {isOther ? (
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder={tr('cancel.otherPlaceholder')}
            placeholderTextColor={C.muted}
            multiline
            style={{ marginTop: 12, minHeight: 64, borderWidth: 1.5, borderColor: C.line, borderRadius: radius.md, padding: 12, fontSize: 14, color: C.ink, textAlignVertical: 'top' }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Btn label={tr('cancel.keep')} variant="outline" onPress={closeCancelReason} style={{ flex: 1, paddingVertical: 13 }} />
          <Btn
            label={tr('cancel.confirm')}
            onPress={canConfirm ? confirm : undefined}
            style={{ flex: 1, paddingVertical: 13, backgroundColor: canConfirm ? C.dangerInk : C.line }}
            textStyle={{ color: '#fff' }}
          />
        </View>
      </View>
    </View>
  );
}

export const shadow = (y = 10, blur = 26, a = 0.18) => ({
  boxShadow: `0 ${y}px ${blur}px -18px rgba(60,40,30,${a})`,
});

const styles = StyleSheet.create({
  caption: {
    flex: 1,
    textAlignVertical: 'center',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.ink,
    opacity: 0.42,
  },
  btn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  btnText: { fontSize: 16, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    paddingBottom: 8,
  },
  navItem: { alignItems: 'center', gap: 4, width: 56, paddingTop: 2 },
  fabWrap: { alignItems: 'center', width: 60, marginTop: -22 },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    boxShadow: `0 12px 24px -8px ${C.accent}`,
  },
});
