import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One haptic per thing the user causes, fired in the same frame as its
 * visual, and never the only feedback. Silent on web.
 */
const enabled = Platform.OS !== 'web';

function fire(run: () => Promise<void>) {
  if (enabled) run().catch(() => {});
}

export const haptics = {
  /** A choice changed: the selected balloon or question. */
  selection: () => fire(() => Haptics.selectionAsync()),
  /** A deliberate commit: asking the question. */
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** The pop, or confirming you leave. */
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Answer sent, room full, the match. */
  success: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Shown together with a visible error. */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
