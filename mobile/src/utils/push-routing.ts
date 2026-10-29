import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

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

if (Platform.OS !== 'web') {
  // While the app is open a push still shows as a banner, quietly.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Opens the room, match or chat a push is about when you tap it, whether the
 * app was open, in the background or not running at all.
 */
export function usePushRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let handled: string | null = null;
    function open(response: Notifications.NotificationResponse) {
      const id = response.notification.request.identifier;
      if (id === handled) return;
      handled = id;
      const href = hrefFor(response.notification.request.content.data);
      if (href) router.push(href);
    }
    // A tap that launched the app.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);
}
