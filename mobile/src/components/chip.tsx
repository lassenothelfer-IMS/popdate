import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /**
   * `radio` (the default): one option of a single-choice group. `checkbox`: one
   * of several you can pick together. `button`: it does something, like "More".
   */
  role?: 'radio' | 'checkbox' | 'button';
  /** Can't be picked right now, like a sixth interest when five are the most. */
  disabled?: boolean;
  /** A hairline pill on the page instead of a filled one, for a chip that isn't an option. */
  outlined?: boolean;
};

const HEIGHT = 36;

/** A 36pt pill sized to its label, ink when selected: one option of a group, or a small action. */
export function Chip({ label, selected, onPress, role = 'radio', disabled = false, outlined = false }: ChipProps) {
  const theme = useTheme();
  const slop = (MinTouch - HEIGHT) / 2;
  const option = role !== 'button';
  return (
    <PressableScale
      accessibilityRole={role}
      // Radios and checkboxes announce `checked`, the same as the option rows in onboarding.
      accessibilityState={option ? { checked: selected, disabled } : { disabled }}
      // react-native-web reads the aria prop, not accessibilityState.
      aria-checked={option ? selected : undefined}
      accessibilityLabel={label}
      disabled={disabled}
      // Drawn at 36pt, touched at 44pt.
      hitSlop={{ top: slop, bottom: slop }}
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.inverse : outlined ? theme.page : theme.surface },
        outlined && { boxShadow: `inset 0 0 0 1px ${theme.borderStrong}` },
        disabled && styles.disabled,
      ]}>
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
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
    textAlign: 'center',
  },
});
