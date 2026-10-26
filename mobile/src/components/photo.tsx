import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

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
 * `mock://` URIs from the mock server render as a tint tile with a soft blob of the
 * person's balloon color, so development screens read like a set, not like errors.
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
        {/* One soft blob of their balloon color on the tint tile, until real photos are wired. */}
        <TintBlob color={fill.color} />
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
      style={[styles.badge, { backgroundColor: 'rgba(18, 4, 10, 0.55)' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* Grows with the text size, but never covers much of the photo. */}
      <ThemedText type="captionStrong" maxFontSizeMultiplier={1.35} style={{ color: theme.text }}>
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

/**
 * The placeholder's blob: one soft circle of the balloon color at about 70%,
 * fading out like a 40 to 60 px blur (React Native can't blur a view on iOS).
 */
function TintBlob({ color }: { color: string }) {
  const id = `blob${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="58%" cy="42%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.7} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="58%" cy="42%" r="50%" fill={`url(#${id})`} />
    </Svg>
  );
}
