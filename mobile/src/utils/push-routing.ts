import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/state/session';
import { sendChangedToken } from '@/utils/push';

/** What the server puts in a push's data, so a tap knows where to go. */
type PushData =
  | { type: 'room'; roomId: string }
  | { type: 'match'; matchId: string }
  | { type: 'chat'; matchId: string }
  | { type: 'matches' };

function hrefFor(data: unknown): Href | null {
  const push = data as Partial<PushData> | undefined;
  if (push?.type === 'room' && push.roomId) return `/room/${push.roomId}` as Href;
  if (push?.type === 'match' && push.matchId) return `/match/${push.matchId}` as Href;
  if (push?.type === 'chat' && push.matchId) return `/chat/${push.matchId}` as Href;
  if (push?.type === 'matches') return '/matches' as Href;
  return null;
}

/** The match whose chat is on screen: its messages already show, so they need no banner. */
let openChat: string | null = null;

/** The chat screen says which match it shows, and null when it closes. */
export function setOpenChat(matchId: string | null) {
  openChat = matchId;
}

if (Platform.OS !== 'web') {
  // While the app is open a push still shows as a banner, quietly.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const push = notification.request.content.data as Partial<PushData> | undefined;
      const inChat = push?.type === 'chat' && push.matchId === openChat;
      return {
        shouldShowBanner: !inChat,
        shouldShowList: !inChat,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}

/** The last push opened, kept across sign-ins so one tap never opens its screen twice. */
let handled: string | null = null;

/**
 * Opens the room, match or chat a push is about when you tap it, whether the
 * app was open, in the background or not running at all. Only once you're
 * signed in: before that, the screen it opens couldn't load anything. A tap
 * that comes in meanwhile waits as the last response and is opened then.
 */
export function usePushRouting() {
  const { ready } = useSession();

  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return;
    function open(response: Notifications.NotificationResponse) {
      const id = response.notification.request.identifier;
      // Handled now: forget it, so a later launch or sign-in doesn't open it again.
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Not there on this platform: the id check below still holds.
      }
      if (id === handled) return;
      handled = id;
      const href = hrefFor(response.notification.request.content.data);
      if (href) router.push(href);
    }
    // A tap that launched the app, or came in while signing in.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);

  // The push service can replace a phone's token while the app runs: send the new one.
  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return;
    const subscription = Notifications.addPushTokenListener((token) => void sendChangedToken(token));
    return () => subscription.remove();
  }, [ready]);
}
