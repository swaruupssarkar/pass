import { usePathname } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, type ReactNode } from 'react';
import { TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { captureScreen, posthog } from '@/pass/analytics';
import { PassProvider } from '@/pass/store';
import { C } from '@/pass/theme';
import { CancelReasonSheet, NotifyNudge, PassDialog, SyncOverlay } from '@/pass/ui';

// App-wide: kill the spell-check / autocorrect underline under typed text, plus
// Android's default TextInput underline (which renders in the accent color).
// (Individual inputs can still override these props.)
const TI = TextInput as unknown as { defaultProps?: Record<string, unknown> };
TI.defaultProps = { ...(TI.defaultProps ?? {}), autoCorrect: false, spellCheck: false, underlineColorAndroid: 'transparent' };

// Records a $screen view on every route change → powers "most-used screens".
// (We track manually off expo-router's pathname rather than autocapture's screen
// hook, which doesn't see expo-router's navigation container reliably.)
function ScreenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) captureScreen(pathname);
  }, [pathname]);
  return null;
}

// Wrap the app in PostHog autocapture (touches + app lifecycle) when configured;
// pass through untouched when there's no key.
function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;
  return (
    <PostHogProvider client={posthog} autocapture={{ captureTouches: true, captureScreens: false }}>
      {children}
    </PostHogProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
        <Analytics>
          <PassProvider>
            <StatusBar style="dark" />
            <ScreenTracker />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: C.bg },
                // smooth crossfade everywhere — avoids Android's default slide-up jitter
                animation: 'fade',
                animationDuration: 200,
              }}
            />
            <PassDialog />
            <CancelReasonSheet />
            <SyncOverlay />
            <NotifyNudge />
          </PassProvider>
        </Analytics>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
