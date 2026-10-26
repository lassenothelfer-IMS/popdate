import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Ease, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The popper's initial (or photo) settles into the seat once the room is known. Opacity only. */
const personIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The person choosing sits beside the balloons as a 44pt plush circle with a gold ring. */
export const POPPER_SEAT_SIZE = 44;
/** Matches the outline of an empty balloon seat. */
const GHOST_STROKE = 1.5;

type PopperSeatProps = {
  filled: boolean;
  /** Once the room is known: the popper, whose initial (or photo) fades in. */
  name?: string | null;
  photoUri?: string | null;
};

/**
 * The one seat in the queue that isn't a balloon: the person choosing, as a 44pt
 * avatar on plush with a gold ring. Empty, it is a borderStrong outline like an empty
 * balloon seat; filled before the room answers, it is the bare tile.
 * Decorative: the queue count carries the meaning.
 */
export function PopperSeat({ filled, name, photoUri }: PopperSeatProps) {
  const theme = useTheme();

  if (!filled) {
    return (
      <View style={[styles.seat, { borderWidth: GHOST_STROKE, borderColor: theme.borderStrong }]} />
    );
  }

  // Plush, like every avatar in Velvet hour.
  const tile = theme.surface;
  return (
    <View
      style={[
        styles.seat,
        { backgroundColor: tile },
        // The avatar brings its own hairline ring; two stacked would read darker.
        !name && { borderWidth: 1, borderColor: theme.borderStrong },
      ]}>
      {name ? (
        <Animated.View entering={personIn} style={StyleSheet.absoluteFill}>
          <Avatar
            name={name}
            uri={photoUri}
            tone={{ color: theme.text, tint: tile }}
            size={POPPER_SEAT_SIZE}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    width: POPPER_SEAT_SIZE,
    height: POPPER_SEAT_SIZE,
    borderRadius: POPPER_SEAT_SIZE / 2,
  },
});
