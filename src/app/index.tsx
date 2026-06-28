import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';

export default function Splash() {
  const router = useRouter();
  const tr = useT();
  const { s } = usePass();
  const focused = useIsFocused();

  // once cache + session resolve: signed-in users skip the splash (to the feed,
  // or into the rest of onboarding); signed-out users tap to start → intro → login.
  // Gate on `focused`: this screen stays mounted under intro/login, so without it
  // a fresh session (e.g. mid sign-up OTP) would redirect to the dashboard and
  // skip the create-password step. Only redirect while the splash is foreground.
  useEffect(() => {
    if (!focused || !s.hydrated || !s.authReady) return;
    if (s.currentUserId) router.replace(s.onboarded ? '/feed' : '/profile-setup');
  }, [focused, s.hydrated, s.authReady, s.currentUserId, s.onboarded, router]);

  // Show the "tap to start" intro ONLY once we know the user is signed out. While the
  // cache/session are still resolving — or while redirecting a signed-in user — render a
  // plain splash (icon on accent, visually identical to the native splash). This stops the
  // intro from flashing on reopen for returning users.
  const showIntro = s.hydrated && s.authReady && !s.currentUserId;
  if (!showIntro) {
    return (
      <View style={{ flex: 1, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <View style={{ borderRadius: 26, borderCurve: 'continuous', boxShadow: '0 18px 40px -14px rgba(0,0,0,0.4)' }}>
          <Image source={require('../../assets/images/icon.png')} style={{ width: 104, height: 104, borderRadius: 26 }} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push('/intro')}
      style={{ flex: 1, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style="light" />
      <View style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <View style={{ position: 'absolute', bottom: -70, left: -50, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />

      <View style={{ borderRadius: 26, borderCurve: 'continuous', boxShadow: '0 18px 40px -14px rgba(0,0,0,0.4)' }}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: 104, height: 104, borderRadius: 26 }} />
      </View>
      <Image
        source={require('../../assets/images/wordmark.png')}
        resizeMode="contain"
        style={{ width: 168, height: 48, marginTop: 24 }}
      />
      <KindTagline raw={tr('index.tagline')} />
      <Text style={{ position: 'absolute', bottom: 50, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>{tr('index.tapToStart')}</Text>
    </Pressable>
  );
}

// Tagline with the "kindness" word (wrapped in *…* per-language) softly glowing —
// a warm gold shimmer + gentle opacity pulse so the screen feels alive.
function KindTagline({ raw }: { raw: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [p]);
  const glow = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], ['#FFC56B', '#FFF0CE']),
    opacity: 0.85 + p.value * 0.15,
  }));

  const base = { fontSize: 17, color: 'rgba(255,255,255,0.92)', textAlign: 'center' as const, marginTop: 12, lineHeight: 26, fontWeight: '500' as const, maxWidth: 300 };
  const [pre, word, post] = raw.split('*');
  if (word === undefined) return <Text style={base}>{raw}</Text>;
  return (
    <Text style={base}>
      {pre}
      <Animated.Text style={[{ fontWeight: '800' as const }, glow]}>{word}</Animated.Text>
      {post}
    </Text>
  );
}
