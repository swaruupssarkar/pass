import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { C } from '@/pass/theme';

// OAuth deep-link landing. When Google redirects to `daata://auth-callback?code=…`,
// Android also delivers it to the router (separate from WebBrowser.openAuthSessionAsync,
// which the store uses to finish the session). Without this route expo-router shows a
// jarring "Unmatched Route" flash. We render the brand splash and bounce to `/`, which
// routes to feed/onboarding once the session resolves — login.tsx drives the final hop.
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="light" />
      <View style={{ borderRadius: 26, borderCurve: 'continuous', boxShadow: '0 18px 40px -14px rgba(0,0,0,0.4)' }}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: 96, height: 96, borderRadius: 24 }} />
      </View>
      <ActivityIndicator color="#fff" style={{ marginTop: 28 }} />
    </View>
  );
}
