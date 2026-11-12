import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

/** How far, or how fast, a sideways swipe has to go to count. */
const DISTANCE = 56;
const VELOCITY = 520;

type SideSwipeProps = {
  /** A swipe from right to left, like turning to the next page. */
  onLeft?: () => void;
  /** A swipe from left to right, like turning back. */
  onRight?: () => void;
  children: ReactNode;
  /** Laid on the content's own box, like a gap between its children. */
  style?: StyleProp<ViewStyle>;
  /** Takes all the room it is given (the default). Off inside a scrolling page, where it is as tall as its content. */
  fill?: boolean;
};

/**
 * Lets a sideways swipe anywhere on its content turn the page: Chat to Profile
 * and back. Scrolling up and down is left alone, since the swipe only starts
 * once the finger has clearly moved sideways.
 */
export function SideSwipe({ onLeft, onRight, children, style, fill = true }: SideSwipeProps) {
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd(({ translationX, velocityX }) => {
      if (Math.abs(translationX) < DISTANCE && Math.abs(velocityX) < VELOCITY) return;
      if (translationX < 0) onLeft?.();
      else onRight?.();
    });
  return (
    <GestureHandlerRootView style={fill ? styles.fill : undefined}>
      <GestureDetector gesture={swipe}>
        <View style={[fill && styles.fill, style]}>{children}</View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
