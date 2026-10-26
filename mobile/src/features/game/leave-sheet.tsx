import { useEffect, useEffectEvent, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TITLE = 'Leave this room?';
const DEFAULT_MESSAGE = "Your balloon pops and you can't rejoin.";

/** Scrim and sheet fade in together. Opacity only, so it stays under Reduce Motion. */
const fadeIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/**
 * The sheet rises from the bottom edge. A built-in, so the web plays it as it is
 * (a custom Keyframe would need webSafeKeyframe there). Under Reduce Motion only the fade plays.
 */
const sheetIn = SlideInDown.duration(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.System);

type LeaveSheetProps = {
  /** Under the title: what leaving costs you. */
  message?: string;
  onLeave: () => void;
  /** Stay, the scrim and Escape all keep you in the room. */
  onStay: () => void;
  /** While the leave call runs: Leave spins and nothing else answers. */
  leaving?: boolean;
  /** A failed leave, shown above the buttons, since the sheet covers the room's own error line. */
  error?: string | null;
};

/**
 * Confirms leaving a room on the web, where Alert does nothing (iOS and Android keep
 * the native alert). It fills its parent, so render it over the whole screen.
 */
export function LeaveSheet({
  message = DEFAULT_MESSAGE,
  onLeave,
  onStay,
  leaving = false,
  error = null,
}: LeaveSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<ViewInstance>(null);

  function stay() {
    if (!leaving) onStay();
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') stay();
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Focus starts in the dialog, so keyboard and screen reader users land in it, not
    // behind it. On web the ref is the DOM node: no scrolling toward it while it rises.
    (sheetRef.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Animated.View entering={fadeIn} style={styles.root} accessibilityViewIsModal>
      {/* Tapping beside the sheet is Stay. Hidden from screen readers, which get the Stay button. */}
      <Pressable
        aria-hidden
        focusable={false}
        onPress={stay}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
      />
      <Animated.View entering={sheetIn} style={styles.slot}>
        <View
          ref={sheetRef}
          role="dialog"
          aria-modal
          aria-label={TITLE}
          tabIndex={-1}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.sheet,
              borderTopColor: theme.outline,
              paddingBottom: Math.max(insets.bottom, Space.md),
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.surfacePressed }]} />
          <ThemedText type="task" accessibilityRole="header" style={[styles.center, styles.title]}>
            {TITLE}
          </ThemedText>
          <ThemedText
            type="callout"
            themeColor="textSecondary"
            style={[styles.center, styles.message]}>
            {message}
          </ThemedText>
          {error ? (
            <View style={styles.error}>
              <ErrorLine message={error} />
            </View>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title="Leave" variant="ghost" loading={leaving} onPress={onLeave} />
            </View>
            <View style={styles.action}>
              <Button title="Stay" disabled={leaving} onPress={stay} />
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Full width on a phone; on a wide window, as wide as the screens it covers.
  slot: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: Gutter,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  center: {
    textAlign: 'center',
  },
  title: {
    marginTop: 18,
  },
  message: {
    marginTop: Space.xxs,
  },
  error: {
    marginTop: Space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Space.xs,
    marginTop: 20,
  },
  // The text action centers on the ink pill beside it.
  action: {
    flex: 1,
    justifyContent: 'center',
  },
});
