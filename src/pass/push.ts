// Expo push-token registration + notification handling for "new items near me".
// expo-notifications is dynamically imported so its native module is only touched
// on a real device build (never in unsupported contexts), mirroring the lazy load
// used for the permission prompt elsewhere.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { hasSupabase } from '@/pass/config';
import { upsertPushToken } from '@/pass/repo';

/** Resolve the EAS projectId — required by getExpoPushTokenAsync in a build. */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Show push banners while the app is foregrounded. Call once at startup. */
export async function configureForegroundNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    /* native module unavailable (e.g. web / Expo Go) — ignore */
  }
}

/** Ask permission (if needed), get the Expo push token, persist it server-side.
 *  Idempotent (the upsert key is user+token); safe to call on every sign-in and
 *  when the user turns "near me" on. No-ops without Supabase or on web. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!hasSupabase() || Platform.OS === 'web' || !userId) return null;
  try {
    const Notifications = await import('expo-notifications');
    // Android needs a channel for heads-up (peek) notifications.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'New items near you',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FA6023',
      });
    }
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const pid = projectId();
    const token = (await Notifications.getExpoPushTokenAsync(pid ? { projectId: pid } : undefined)).data;
    await upsertPushToken(userId, token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}
