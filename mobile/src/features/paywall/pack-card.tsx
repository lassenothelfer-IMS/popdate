import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  Keyframe,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Ease, Fonts, Motion, Radius } from '@/constants/theme';
import { BalloonCluster } from '@/features/paywall/balloon-cluster';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/color';
import { haptics } from '@/utils/haptics';
import { webSafeKeyframe } from '@/utils/web-motion';

export const CARD_WIDTH = 236;
export const CARD_HEIGHT = 286;
export const CARD_GAP = 12;
/** The cards either side of the middle one sit a little smaller. */
const SIDE_SCALE = 0.96;

/** The cards come in one after another: 0, 120 and 200 ms after the sheet. */
const DELAYS = [0, 120, 200];
const entrances = DELAYS.map((delay) =>
  webSafeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.97 }] },
      100: {
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: 1 }],
        easing: Ease.rise,
      },
    })
      .duration(700)
      .delay(delay),
  ),
);

type PackCardProps = {
  index: number;
  /** How many balloons the pack holds: picks its cluster. */
  balloons: number;
  /** "5 balloons". */
  name: string;
  /** "CHF 1.40 each"; hidden while the store's price isn't in. */
  each: string;
  blurb: string;
  /** "Most popular", "Save 42%". */
  tag?: string;
  selected: boolean;
  /** The carousel's offset, so the card grows as it reaches the middle. */
  scrollX: SharedValue<number>;
  onPress: () => void;
};

/**
 * One balloon pack in the buy sheet's carousel: its balloons, size, price per
 * balloon and a line about it. The middle card is the selected one: it has the
 * accent ring and full size; its neighbours sit at 96%.
 */
export function PackCard({
  index,
  balloons,
  name,
  each,
  blurb,
  tag,
  selected,
  scrollX,
  onPress,
}: PackCardProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const step = CARD_WIDTH + CARD_GAP;

  const lift = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollX.get(),
          [(index - 1) * step, index * step, (index + 1) * step],
          [SIDE_SCALE, 1, SIDE_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // The ring and the wash fade with the selection, over 180 ms.
  const fade = {
    opacity: selected ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: Motion.state,
  } as const;

  return (
    <Animated.View
      entering={reduced ? undefined : entrances[Math.min(index, entrances.length - 1)]}>
      <Animated.View style={lift}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: selected }}
          aria-checked={selected}
          accessibilityLabel={[tag, name, each, blurb].filter(Boolean).join(', ')}
          onPress={() => {
            if (!selected) haptics.selection();
            onPress();
          }}
          style={[styles.card, { backgroundColor: theme.sheet, borderColor: theme.outline }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { backgroundColor: withAlpha(theme.brand, 0.1) }, fade]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, styles.ring, { borderColor: theme.brand }, fade]}
          />
          <BalloonCluster balloons={balloons} />
          <ThemedText type="display" style={styles.name} maxFontSizeMultiplier={1.2}>
            {name}
          </ThemedText>
          <ThemedText type="headline" themeColor="textSecondary" style={styles.each}>
            {each}
          </ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.blurb}>
            {blurb}
          </ThemedText>
        </Pressable>
        {tag ? (
          <View style={styles.tagRow} pointerEvents="none">
            <View style={[styles.tag, { backgroundColor: theme.brand }]}>
              <Text style={[styles.tagText, { color: theme.onAccent }]}>{tag}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 26,
    paddingHorizontal: 18,
    gap: 6,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Over the 1 pt hairline, so the ring replaces it.
    margin: -1,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  ring: {
    borderWidth: 1.5,
  },
  name: {
    marginTop: 6,
    textAlign: 'center',
  },
  each: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  blurb: {
    width: 190,
    marginTop: 4,
    lineHeight: 17,
    textAlign: 'center',
  },
  tagRow: {
    position: 'absolute',
    top: -11,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tag: {
    borderRadius: Radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.22,
  },
});
