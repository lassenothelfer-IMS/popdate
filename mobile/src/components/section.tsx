import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';

type SectionProps = {
  title: string;
  /** A short note at the end of the title row, like "2 of 6". */
  aside?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A titled group of content on a screen. Every section title looks the same. */
export function Section({ title, aside, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.titleRow}>
        <ThemedText type="headline" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
        {aside ? (
          <ThemedText type="footnote" themeColor="textSecondary">
            {aside}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.xs,
  },
  title: {
    flexShrink: 1,
  },
});
