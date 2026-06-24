import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PassProvider } from '@/pass/store';
import { C } from '@/pass/theme';
import { CancelReasonSheet, PassDialog } from '@/pass/ui';

// App-wide: kill the spell-check / autocorrect underline under typed text, plus
// Android's default TextInput underline (which renders in the accent color).
// (Individual inputs can still override these props.)
const TI = TextInput as unknown as { defaultProps?: Record<string, unknown> };
TI.defaultProps = { ...(TI.defaultProps ?? {}), autoCorrect: false, spellCheck: false, underlineColorAndroid: 'transparent' };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PassProvider>
          <StatusBar style="dark" />
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
        </PassProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
