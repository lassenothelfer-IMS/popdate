import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = ViewProps & {
  /** `surface` on the page, `field` for the raised layer. */
  tone?: 'surface' | 'field';
  /** Marked for pop: a pop-red ring and a faint red wash. Only for that. */
  selected?: boolean;
};

/**
 * A flat group of content. One container level per screen: don't nest cards,
 * and don't wrap something in a card just to give it a box.
 */
export function Card({ tone = 'surface', selected = false, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: selected ? theme.accentWash : theme[tone] },
        style,
      ]}
      {...rest}>
      {children}
      {selected ? (
        // An overlay, so marking a card never moves its content.
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: theme.accent }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    padding: Space.md,
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
});
