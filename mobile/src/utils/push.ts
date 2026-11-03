import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Where push permission stands, without asking. The web has no push here: it reads as denied. */
export async function getPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Asks for push permission (iOS shows its prompt once; after a "Don't Allow" only
 * Settings can change it), then sends this phone's token to the server.
 * Resolves with the permission. A token that can't be fetched yet, as in Expo Go
 * without an EAS project id, doesn't count as a failure: the permission stands.
 */
export async function enablePush(): Promise<PushPermission> {
  if (Platform.OS === 'web') return 'denied';
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status === 'granted') await sendToken();
  return status;
}

/**
 * Sends this phone's token for the account signed in now, without asking for
 * anything: only when push is already allowed. The session calls it after every
 * sign-in, so a new account after signing out gets its pushes too. Quiet on failure.
 */
export async function registerPushIfAllowed() {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') await sendToken();
  } catch {
    // Can't tell: the next sign-in tries again.
  }
}

/** The send in flight, so calls that overlap share it instead of registering twice. */
let sending: Promise<void> | null = null;

function sendToken() {
  sending ??= (async () => {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await api.registerPushToken(data);
    } catch {
      // No token yet (Expo Go without an EAS project id, or offline). The next launch tries again.
    } finally {
      sending = null;
    }
  })();
  return sending;
}
