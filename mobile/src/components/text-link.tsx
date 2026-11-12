import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Fonts, MinTouch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type TextLinkProps = {
  title: string;
  onPress: () => void;
  /** Busy: a spinner beside the words, and no second press. */
  loading?: boolean;
  /** The words and their line. The text color unless said otherwise, like white over a photo. */
  color?: string;
  accessibilityHint?: string;
};

const HEIGHT = 28;

/**
 * The quiet action: words in the text color with a line under them. For the
 * second thing a screen offers, or the only thing on a screen that should stay
 * calm, where a black pill would shout.
 */
export function TextLink({ title, onPress, loading = false, color, accessibilityHint }: TextLinkProps) {
  const theme = useTheme();
  const ink = color ?? theme.text;
  const slop = (MinTouch - HEIGHT) / 2;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      hitSlop={{ top: slop, bottom: slop, left: 8, right: 8 }}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={styles.link}>
      <View style={[styles.words, { borderBottomColor: ink }]}>
        <Text style={[styles.label, { color: ink }]}>{title}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={ink} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    minHeight: HEIGHT,
  },
  words: {
    borderBottomWidth: 1.5,
    paddingBottom: 3,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 600,
  },
});
