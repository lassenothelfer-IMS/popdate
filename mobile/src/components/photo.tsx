import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MOCK_PREFIX = 'mock://';

/** The hue behind a placeholder: the person's seat color, or a neutral one for you. */
export type PhotoTone = { color: string; tint: string };

type PhotoProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Describes the photo for VoiceOver, for example "Mia, photo 2". */
  accessibilityLabel?: string;
  /** The person's name. A placeholder shows its first letter. */
  name?: string;
  /** The person's hue. A placeholder sits on its tint with the letter in the hue. */
  tone?: PhotoTone;
  /** Size of the placeholder's letter. Defaults to a third of a phone-width tile. */
  initialSize?: number;
  /**
   * The faint inner edge. Turn it off where the photo gets a stronger outer ring
   * instead, like the big photo on the match and the room result.
   */
  hairline?: boolean;
};

/**
 * A profile photo, cropped to fill its frame (use PhotoAspect for the frame).
 * `mock://` URIs from the mock server render as the person's initial in Gloock
 * on their tint, so development screens read like a set, not like errors.
 */
export function Photo({
  uri,
  style,
  accessibilityLabel,
  name,
  tone,
  initialSize = 56,
  hairline = true,
}: PhotoProps) {
  const theme = useTheme();
  // The hairline edge follows whatever corner the caller gives the frame.
  const radius = StyleSheet.flatten(style)?.borderRadius ?? Radius.md;
  const edge = hairline ? (
    <View
      pointerEvents="none"
      style={[styles.edge, { borderRadius: radius, borderColor: theme.border }]}
    />
  ) : null;
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessibilityElementsHidden: true };

  if (uri.startsWith(MOCK_PREFIX)) {
    const fill = tone ?? { color: theme.text, tint: theme.surface };
    return (
      <View
        {...a11y}
        style={[styles.frame, styles.placeholder, { backgroundColor: fill.tint }, style]}>
        <Text
          style={[styles.initial, { color: fill.color, fontSize: initialSize }]}
          maxFontSizeMultiplier={1}>
          {name ? name.charAt(0).toUpperCase() : ''}
        </Text>
        {edge}
      </View>
    );
  }
  return (
    <View {...a11y} style={[styles.frame, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={Motion.state}
      />
      {edge}
    </View>
  );
}

/**
 * A quiet pill in a photo's top-left corner, like "Photo 1" or "Photo 1 · You".
 * Hidden from VoiceOver: put the same words in the photo's label. The parent
 * must be the photo's frame or a box of the same size.
 */
export function PhotoBadge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.badge, { backgroundColor: theme.surface }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* Grows with the text size, but never covers much of the photo. */}
      <ThemedText type="caption" maxFontSizeMultiplier={1.35}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: Fonts.serif,
    fontWeight: 400,
    includeFontPadding: false,
  },
  // A hairline inside the edge, so a photo never melts into a page of the same tone.
  edge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: Space.sm,
    left: Space.sm,
    minHeight: 24,
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
