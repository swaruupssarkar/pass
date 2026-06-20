import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PassProvider } from '@/pass/store';
import { C } from '@/pass/theme';
import { PassDialog } from '@/pass/ui';

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
            }}
          />
          <PassDialog />
        </PassProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
