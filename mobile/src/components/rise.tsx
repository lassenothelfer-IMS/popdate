import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { Ease, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { webSafeKeyframe } from '@/utils/web-motion';

/** Built once per position: block n starts 40 ms + n x 70 ms after the screen. */
const entrances = new Map<number, InstanceType<typeof Keyframe>>();
function entrance(index: number) {
  let keyframe = entrances.get(index);
  if (!keyframe) {
    keyframe = new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.985 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.rise },
    })
      .duration(Motion.entrance)
      .delay(40 + index * Motion.stagger);
    entrances.set(index, keyframe);
  }
  return keyframe;
}

type RiseProps = {
  /** The block's place on the screen, top to bottom, from 0. */
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * One top-level block of a screen: it fades in and rises 14 pt, scaling from
 * .985, over 760 ms, 70 ms after the block above it. Instant under Reduce Motion.
 */
export function Rise({ index, children, style }: RiseProps) {
  const reduced = useReduceMotion();
  return (
    <Animated.View entering={reduced ? undefined : webSafeKeyframe(entrance(index))} style={style}>
      {children}
    </Animated.View>
  );
}
