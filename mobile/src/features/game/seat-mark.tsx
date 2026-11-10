import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Balloon, PoppedMark } from '@/components/balloon';
import { CssEase, lacquerFor, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** The seat's box in the balloon row: every state sits bottom aligned in it. */
const SEAT_BOX = 24;
/** A balloon in the row is 12 pt wide; the active one (you, or the marked one) 15. */
const BALLOON_SIZE = 12;
const ACTIVE_SIZE = 15;
/** A popped seat: a 14 pt hollow ring at 30%. */
const POPPED_SIZE = 14;
/** Once photos are out, a seat is the person's newest photo in a ring of their balloon color. */
const PHOTO_BOX = 44;
const PHOTO_SIZE = 34;
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
  /** Their newest revealed photo. Once there is one, it takes the balloon's place. */
  photo?: string;
  /** For the photo's placeholder initial. */
  name?: string;
  /** The box is photo sized: someone in the row has a photo, so every seat stands as tall. */
  tall?: boolean;
};

/**
 * A seat's balloon in the balloon row: a 12 pt balloon, the active one 15 pt
 * inside the ring (2 pt of canvas, then 1.5 pt of its own color), and a popped
 * seat as a hollow ring at 30%. All three stay mounted in a fixed box, so a
 * change is a crossfade in place, and a failed pop fades back.
 */
export function SeatMark({
  color,
  state,
  active = false,
  risen = false,
  photo,
  name = '',
  tall = false,
}: SeatMarkProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const ringed = state === 'mark' || (active && state === 'up');
  if (photo) {
    const popped = state === 'pop';
    const seat = lacquerFor(color);
    // The ring: 2 pt of canvas, then their color, thicker on the marked one. A popped seat loses it.
    const ring = popped
      ? `0 0 0 1px ${theme.borderStrong}`
      : `0 0 0 2px ${theme.page}, 0 0 0 ${state === 'mark' ? 5 : 3.5}px ${color}`;
    return (
      <View style={[styles.box, styles.photoBox]}>
        <Animated.View
          style={[
            styles.photo,
            {
              boxShadow: ring,
              transform: [{ translateY: risen && !reduced ? -RISE : 0 }],
              transitionProperty: 'transform',
              transitionDuration: Motion.enter,
              transitionTimingFunction: CssEase.out,
            },
          ]}>
          <Animated.View style={crossfade(true, popped ? 0.35 : 1)}>
            <Avatar
              name={name}
              uri={photo}
              tone={seat ? { color: seat.color, tint: seat.tint } : undefined}
              size={PHOTO_SIZE}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.layer, styles.center, crossfade(popped)]}>
          <PoppedMark color={color} size={16} />
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={[styles.box, tall && styles.photoBox]}>
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
          <Balloon color={color} size={BALLOON_SIZE} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.layer, crossfade(ringed)]}>
        <View
          style={[
            styles.ring,
            { boxShadow: `0 0 0 2px ${theme.page}, 0 0 0 3.5px ${color}` },
          ]}>
          <Balloon color={color} size={ACTIVE_SIZE} />
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
  photoBox: {
    width: PHOTO_BOX,
    height: PHOTO_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    borderRadius: PHOTO_SIZE / 2,
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
