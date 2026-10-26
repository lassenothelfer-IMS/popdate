import { useEffect, useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';

type AuraProps = {
  color: string;
  /** The blob's diameter, before its soft edge. */
  size: number;
  /** How far the blur reaches past the circle, like CSS blur(90px). */
  blur: number;
  opacity: number;
  left: number;
  top: number;
  /** Where the drift ends, and how much it grows on the way. */
  drift: { x: number; y: number; scale: number };
  /** One way of the drift; it then comes back the same way. */
  duration: number;
};

/**
 * One soft blob of color behind the match, drifting slowly back and forth.
 * React Native can't blur a view on iOS, so the blur is drawn: a circle whose
 * color fades out over the blur radius. Holds still under Reduce Motion.
 */
export function Aura({ color, size, blur, opacity, left, top, drift, duration }: AuraProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduced = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, duration, t]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.x * t.get() },
      { translateY: drift.y * t.get() },
      { scale: 1 + (drift.scale - 1) * t.get() },
    ],
  }));
  const box = size + blur * 2;
  const r = box / 2;
  // The solid core ends where the circle's edge was; the blur fades it to nothing.
  const core = (size / 2 - blur / 2) / r;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.aura, { left: left - blur, top: top - blur, width: box, height: box, opacity }, style]}>
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id={`aura${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={color} stopOpacity={1} />
            <Stop offset={Math.max(0, core)} stopColor={color} stopOpacity={0.85} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#aura${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
  },
});
