import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Balloon } from '@/components/balloon';
import { CssEase, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** The seat's box in the balloon row: every state sits bottom aligned in it. */
const SEAT_BOX = 24;
/** A balloon in the row is 12 pt wide; the active one (you, or the marked one) 15. */
const BALLOON_SIZE = 12;
const ACTIVE_SIZE = 15;
/** A popped seat: a 14 pt hollow ring at 30%. */
const POPPED_SIZE = 14;
/** How far the last balloon rises when the game is over. */
const RISE = 6;

export type SeatState = 'up' | 'mark' | 'pop';

type SeatMarkProps = {
  color: string;
  state: SeatState;
  /** You: drawn active, with the ring, whenever your balloon is up. */
  active?: boolean;
  /** The last balloon, once the game is over. */
  risen?: boolean;
};

/**
 * A seat's balloon in the balloon row: a 12 pt balloon, the active one 15 pt
 * inside the ring (2 pt of canvas, then 1.5 pt of its own color), and a popped
 * seat as a hollow ring at 30%. All three stay mounted in a fixed box, so a
 * change is a crossfade in place, and a failed pop fades back.
 */
export function SeatMark({ color, state, active = false, risen = false }: SeatMarkProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const ringed = state === 'mark' || (active && state === 'up');
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
        <Animated.View style={[styles.layer, crossfade(state !== 'pop' && !ringed)]}>
          <Balloon color={color} size={BALLOON_SIZE} string={false} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.layer, crossfade(ringed)]}>
        <View
          style={[
            styles.ring,
            { boxShadow: `0 0 0 2px ${theme.page}, 0 0 0 3.5px ${color}` },
          ]}>
          <Balloon color={color} size={ACTIVE_SIZE} string={false} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.layer, styles.center, crossfade(state === 'pop', 0.3)]}>
        <View style={[styles.popped, { borderColor: color }]} />
      </Animated.View>
    </View>
  );
}

function crossfade(visible: boolean, shown = 1) {
  return {
    opacity: visible ? shown : 0,
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
  center: {
    justifyContent: 'center',
  },
  ring: {
    borderRadius: 6,
  },
  popped: {
    width: POPPED_SIZE,
    height: POPPED_SIZE,
    borderRadius: POPPED_SIZE / 2,
    borderWidth: 1.5,
  },
});
