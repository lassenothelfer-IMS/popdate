import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/state/session';

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

/**
 * The queue screen opens your room by itself when it fills. While it is in
 * front, and for the room it opened, the "your room is open" push would only
 * race it: a banner over round 1, and a tap that opens the room a second time.
 */
let queueInFront = false;
let roomOpenedByQueue: string | null = null;

/** The queue screen says when it is in front, and when it isn't any more. */
export function setQueueInFront(inFront: boolean) {
  queueInFront = inFront;
}

/** The queue screen says which room it is opening, as soon as it knows. */
export function setRoomOpenedByQueue(roomId: string) {
  roomOpenedByQueue = roomId;
}

/** A room push the queue screen already handles. */
function queueHandles(push: Partial<PushData> | undefined) {
  if (push?.type !== 'room') return false;
  return queueInFront || (!!push.roomId && push.roomId === roomOpenedByQueue);
}

if (Platform.OS !== 'web') {
  // While the app is open a push still shows as a banner, quietly.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const push = notification.request.content.data as Partial<PushData> | undefined;
      const banner = !queueHandles(push);
      return {
        shouldShowBanner: banner,
        shouldShowList: banner,
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
      const data = response.notification.request.content.data;
      const push = data as Partial<PushData> | undefined;
      // The queue screen already took you to this room: don't stack a second one.
      if (push?.type === 'room' && push.roomId && push.roomId === roomOpenedByQueue) return;
      const href = hrefFor(data);
      if (href) router.push(href);
    }
    // A tap that launched the app, or came in while signing in.
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);
}
