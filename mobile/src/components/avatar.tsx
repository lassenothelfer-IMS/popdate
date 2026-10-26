import { StyleSheet, Text, View } from 'react-native';

import { Photo, type PhotoTone } from '@/components/photo';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  name: string;
  /** Their first photo. A missing or mock photo shows their initial instead. */
  uri?: string | null;
  /** Their hue. Without one, a neutral circle. */
  tone?: PhotoTone;
  /** Diameter in points: 28 in the role reveal, 40 in a match row, 64 on Home and in the room. */
  size?: number;
  /** Set to make the avatar readable on its own; leave out when a name sits next to it. */
  accessibilityLabel?: string;
};

/** A person in a circle: their photo, or their initial in Gloock on their tint, with a hairline ring. */
export function Avatar({ name, uri, tone, size = 64, accessibilityLabel }: AvatarProps) {
  const theme = useTheme();
  const fill = tone ?? { color: theme.text, tint: theme.surface };
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  // The canvas sets the letter at 14 in a 28 circle, and a little under half the circle above that.
  const letter = Math.round(size <= 32 ? size / 2 : size * 0.44);

  return (
    <View
      {...a11y}
      style={[
        styles.avatar,
        circle,
        // A hairline ring just outside the circle.
        { backgroundColor: fill.tint, boxShadow: `0 0 0 1px ${theme.borderStrong}` },
      ]}>
      {uri && !uri.startsWith('mock://') ? (
        <Photo
          uri={uri}
          hairline={false}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      ) : (
        <Text style={[styles.initial, { color: fill.color, fontSize: letter }]} maxFontSizeMultiplier={1}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontFamily: Fonts.serif,
    fontWeight: 400,
    includeFontPadding: false,
  },
});
