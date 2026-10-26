import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type PillProps = {
  label: string;
  /** `ink`: You and Last balloon. `quiet`: a status like Watching. Never red. */
  tone?: 'ink' | 'quiet';
};

/** A 20pt pill. Pills are the only place the caption sizes are used. */
export function Pill({ label, tone = 'ink' }: PillProps) {
  const theme = useTheme();
  const ink = tone === 'ink';
  return (
    <View
      style={[
        styles.pill,
        ink ? styles.ink : styles.quiet,
        { backgroundColor: ink ? theme.inverse : theme.surface },
      ]}>
      <ThemedText
        type={ink ? 'captionStrong' : 'caption'}
        themeColor={ink ? 'onInverse' : 'text'}
        // Grows with the text size, but stays a pill.
        maxFontSizeMultiplier={1.35}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Marks your own balloon and row. */
export function YouTag() {
  const t = useT();
  return <Pill label={t('common.you')} />;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    minHeight: 20,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ink: {
    paddingHorizontal: 7,
  },
  // Quiet pills sit a little wider, like the canvas's Watching.
  quiet: {
    paddingHorizontal: Space.xs,
  },
});
