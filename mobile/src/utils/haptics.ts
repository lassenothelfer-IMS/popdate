import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One haptic per thing the user causes, fired in the same frame as its
 * visual, and never the only feedback. Silent on web.
 */
const enabled = Platform.OS !== 'web';

/** When the last haptic went out, so a press never gets two. */
let lastAt = 0;

function fire(run: () => Promise<void>) {
  lastAt = Date.now();
  if (enabled) run().catch(() => {});
}

export const haptics = {
  /** Chip and option taps, balloon row changes, toggles. */
  selection: () => fire(() => Haptics.selectionAsync()),
  /**
   * Every tap. The shared press components call this after the press's own
   * handler: if that already gave a haptic (a selection tick, a send), this
   * one stays quiet, so nothing buzzes twice.
   */
  tap: () => {
    if (Date.now() - lastAt < 80) return;
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** Continue, Get in line, sending an answer. */
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Your balloon survives a round: the moment the next round label appears. */
  soft: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** Confirming you leave. */
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /**
   * The pop: a heavy impact, then a short soft decay 120 ms later.
   * expo-haptics has no custom patterns, so two impacts stand in for it.
   */
  pop: () => {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)), 120);
  },
  /** The match, verification passed, room found. */
  success: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** 10 s left on your answer. */
  warning: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Errors are quiet inline cards, so they never buzz. Kept so callers stay simple. */
  error: () => {},
};
