import { StyleSheet, Text, View } from 'react-native';

import { Balloon } from '@/components/balloon';
import { Fonts, MinTouch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Popdate" in Gloock after a small pop-red balloon. Small on purpose: the content leads. */
export function Wordmark() {
  const theme = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Popdate">
      <Balloon color={theme.accent} size={13} string={false} shine={false} />
      <Text style={[styles.text, { color: theme.text }]} maxFontSizeMultiplier={1.3}>
        Popdate
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MinTouch,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: Fonts.serif,
    fontWeight: 400,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.23,
  },
});
