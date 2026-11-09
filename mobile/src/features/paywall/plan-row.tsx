import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/color';
import { haptics } from '@/utils/haptics';

export const PLAN_ROW_HEIGHT = 56;

type PlanRowProps = {
  /** "Annual". */
  title: string;
  /** "CHF 70.80 billed once a year". */
  detail: string;
  /** "CHF 5.90 / mo". */
  price: string;
  /** "Best value, save 40%", on the row's top edge. */
  tag?: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * One Popdate+ plan: a radio, its name and billing, and its price. Selected, it
 * gets the accent ring, a 10% accent wash and a filled check, fading in over 180 ms.
 */
export function PlanRow({ title, detail, price, tag, selected, onPress }: PlanRowProps) {
  const theme = useTheme();
  const fade = {
    opacity: selected ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: Motion.state,
  } as const;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={[title, tag, detail, price].filter(Boolean).join(', ')}
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      style={[styles.row, { backgroundColor: theme.field, borderColor: theme.outline }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, { backgroundColor: withAlpha(theme.brand, 0.1) }, fade]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, styles.ring, { borderColor: theme.brand }, fade]}
      />
      <View style={styles.left}>
        <View style={[styles.radio, { borderColor: theme.control }]}>
          <Animated.View style={[styles.check, { backgroundColor: theme.brand }, fade]}>
            <Icon name="check" size={10} color={theme.onAccent} />
          </Animated.View>
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        </View>
      </View>
      <Text style={[styles.price, { color: theme.text }]} numberOfLines={1}>
        {price}
      </Text>
      {tag ? (
        <View style={[styles.tag, { backgroundColor: theme.brand }]} pointerEvents="none">
          <Text style={[styles.tagText, { color: theme.onAccent }]}>{tag}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: PLAN_ROW_HEIGHT,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: -1,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  ring: {
    borderWidth: 1.5,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: 2,
    flexShrink: 1,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 600,
  },
  price: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  tag: {
    position: 'absolute',
    top: -9,
    left: 14,
    borderRadius: Radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  tagText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
});
