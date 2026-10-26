import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const HEIGHT = 36;

/** One option of a single-choice group: a 36pt pill sized to its label, ink when selected. */
export function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useTheme();
  const slop = (MinTouch - HEIGHT) / 2;
  return (
    <PressableScale
      accessibilityRole="radio"
      // Radios announce `checked`, the same as the option rows in onboarding.
      accessibilityState={{ checked: selected }}
      // react-native-web reads the aria prop, not accessibilityState.
      aria-checked={selected}
      accessibilityLabel={label}
      // Drawn at 36pt, touched at 44pt.
      hitSlop={{ top: slop, bottom: slop }}
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      style={[styles.chip, { backgroundColor: selected ? theme.inverse : theme.surface }]}>
      <Text style={[styles.label, { color: selected ? theme.onInverse : theme.text }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: HEIGHT,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: Space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
    textAlign: 'center',
  },
});
