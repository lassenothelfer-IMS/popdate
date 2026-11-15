import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { haptics } from '@/utils/haptics';

/** The strip along the left edge where the swipe has to start, like the system's. */
const EDGE = 28;
/** How far, or how fast, the swipe has to go to count. */
const DISTANCE = 64;
const VELOCITY = 520;

type EdgeBackProps = {
  /** Where Back goes. Without it the gesture is off. */
  onBack?: () => void;
  children: ReactNode;
};

/**
 * Swipe-back for steps that live inside one screen (onboarding, profile setup),
 * where the system's own gesture has nothing to pop: a swipe that starts at the
 * left edge and travels right does what the step's Back button does. It only
 * claims touches that begin on the edge, so fields, lists and the date wheel
 * are left alone.
 */
export function EdgeBack({ onBack, children }: EdgeBackProps) {
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(!!onBack)
    .hitSlop({ left: 0, width: EDGE })
    .activeOffsetX(16)
    .failOffsetY([-18, 18])
    .onEnd(({ translationX, velocityX }) => {
      if (translationX < DISTANCE && velocityX < VELOCITY) return;
      haptics.tap();
      onBack?.();
    });
  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={swipe}>{children}</GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
