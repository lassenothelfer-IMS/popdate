import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** Fewer than this and there is no row: a line of one or two is not a crowd. */
export const MIN_FACES = 3;
const MAX_FACES = 6;
const SIZE = 40;
const OVERLAP = 10;

/**
 * The people in line right now, as a row of small circles: blurred beyond
 * recognition and without color, so the line has people in it but nobody is
 * shown before a room. The server only ever sends a tiny, already blurred
 * picture; the blur here just smooths it. Shows real people only, never
 * stand-ins, and nothing at all for a line shorter than three.
 */
export function QueueFaces({ faces }: { faces: readonly string[] }) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  if (faces.length < MIN_FACES) return null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(Motion.entrance)}
      exiting={reduced ? undefined : FadeOut.duration(Motion.exit)}
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {faces.slice(0, MAX_FACES).map((uri, index) => (
        <View
          key={`${index}:${uri}`}
          style={[
            styles.face,
            styles.gray,
            { backgroundColor: theme.surface, borderColor: theme.page, marginLeft: index ? -OVERLAP : 0 },
          ]}>
          <Image
            source={uri}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            blurRadius={10}
            transition={Motion.enter}
          />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
  },
  gray: {
    filter: [{ grayscale: 1 }],
  },
});
