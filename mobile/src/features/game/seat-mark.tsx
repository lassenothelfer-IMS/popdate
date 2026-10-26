import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Balloon, PoppedMark } from '@/components/balloon';
import { CssEase, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** The seat's box in the room bar: every state sits bottom aligned in it. */
const SEAT_BOX = 40;
const BALLOON_SIZE = 24;
/** The marked balloon is a size down, so it fits inside its ring. */
const MARKED_SIZE = 20;
const RING = 2;
/** How far the last balloon rises when the game is over. */
const RISE = 6;

export type SeatState = 'up' | 'mark' | 'pop';

type SeatMarkProps = {
  color: string;
  state: SeatState;
  /** The last balloon, once the game is over. */
  risen?: boolean;
};

/**
 * A seat's balloon in the room bar: up, marked inside a pop-red ring, or the
 * popped mark. All three stay mounted in a fixed box with no text in it, so a
 * change is a crossfade in place and never a remount, and a failed pop fades
 * back. The burst itself only plays in the pop news.
 */
export function SeatMark({ color, state, risen = false }: SeatMarkProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  return (
    <View style={styles.box}>
      <Animated.View
        style={[
          styles.layer,
          {
            transform: [{ translateY: risen && !reduced ? -RISE : 0 }],
            transitionProperty: 'transform',
            transitionDuration: Motion.enter,
            transitionTimingFunction: CssEase.out,
          },
        ]}>
        <Animated.View style={[styles.layer, crossfade(state === 'up')]}>
          <Balloon color={color} size={BALLOON_SIZE} />
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={[
          styles.layer,
          styles.marked,
          { boxShadow: `inset 0 0 0 ${RING}px ${theme.accentText}` },
          crossfade(state === 'mark'),
        ]}>
        <Balloon color={color} size={MARKED_SIZE} string={false} shine={false} />
      </Animated.View>
      <Animated.View style={[styles.layer, crossfade(state === 'pop')]}>
        <PoppedMark color={color} size={BALLOON_SIZE} />
      </Animated.View>
    </View>
  );
}

function crossfade(visible: boolean) {
  return {
    opacity: visible ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: Motion.state,
    transitionTimingFunction: CssEase.out,
  } as const;
}

const styles = StyleSheet.create({
  box: {
    width: SEAT_BOX,
    height: SEAT_BOX,
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  marked: {
    justifyContent: 'center',
    borderRadius: SEAT_BOX / 2,
  },
});
