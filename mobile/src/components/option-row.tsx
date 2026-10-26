import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type CheckMarkProps = {
  checked: boolean;
  /** `radio`: a circle, for one choice. `checkbox`: a rounded square, for a yes/no or several. */
  shape?: 'radio' | 'checkbox';
};

/** The 22pt indicator: an empty ring at rest, filled with ink and a check when chosen. */
export function CheckMark({ checked, shape = 'radio' }: CheckMarkProps) {
  const theme = useTheme();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        shape === 'checkbox' && styles.square,
        {
          backgroundColor: checked ? theme.inverse : 'transparent',
          borderColor: checked ? theme.inverse : theme.control,
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: Motion.state,
          transitionTimingFunction: CssEase.out,
        },
      ]}>
      {checked ? <Icon name="check" size={12} color={theme.onInverse} /> : null}
    </Animated.View>
  );
}

type OptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  shape?: 'radio' | 'checkbox';
};

/** One answer in a short list, like "Woman" under "I'm a": a raised 56pt row with its mark on the right. */
export function OptionRow({ label, selected, onPress, shape = 'radio' }: OptionRowProps) {
  const theme = useTheme();
  return (
    <PressableHighlight
      accessibilityRole={shape === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected }}
      // react-native-web reads the aria prop, not accessibilityState.
      aria-checked={selected}
      accessibilityLabel={label}
      background={theme.field}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.row, { borderColor: selected ? theme.borderStrong : theme.outline }]}>
      <ThemedText type="body" style={styles.label}>
        {label}
      </ThemedText>
      <View>
        <CheckMark checked={selected} shape={shape} />
      </View>
    </PressableHighlight>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    borderRadius: Radius.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    minHeight: 56,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  label: {
    flexShrink: 1,
    fontWeight: 500,
  },
});
