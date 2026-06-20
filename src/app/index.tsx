import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { usePass, useT } from '@/pass/store';
import { C } from '@/pass/theme';

export default function Splash() {
  const router = useRouter();
  const tr = useT();
  const { s } = usePass();

  // returning user: skip onboarding once persisted state has loaded
  useEffect(() => {
    if (s.hydrated && s.onboarded) router.replace('/feed');
  }, [s.hydrated, s.onboarded, router]);

  return (
    <Pressable
      onPress={() => router.push('/intro')}
      style={{ flex: 1, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style="light" />
      <View style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <View style={{ position: 'absolute', bottom: -70, left: -50, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />

      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 30,
          borderCurve: 'continuous',
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 18px 40px -14px rgba(0,0,0,0.4)',
        }}>
        <Text style={{ fontSize: 46, fontWeight: '800', color: C.accent, letterSpacing: -2 }}>p</Text>
      </View>
      <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 24 }}>pass</Text>
      <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 10, lineHeight: 26, fontWeight: '500', maxWidth: 260 }}>
        {tr('index.tagline', { br: '\n' })}
      </Text>
      <Text style={{ position: 'absolute', bottom: 50, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>{tr('index.tapToStart')}</Text>
    </Pressable>
  );
}
