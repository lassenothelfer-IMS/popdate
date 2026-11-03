import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Photo } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { Velvet, type Seat } from '@/constants/theme';

const MOCK_PREFIX = 'mock://';

type PhotoCardProps = {
  uri: string;
  /** "Mia, 27", drawn on the scrim at the bottom left. */
  label: string;
  /** The person's balloon: their tint tile and its blob, until real photos are wired. */
  seat: Seat;
  width: number;
  height: number;
  radius: number;
  /** Their name for VoiceOver, for example "Mia, photo 1". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A match card: their photo (or their tint tile with one soft blob of their
 * balloon color), the photo scrim, and their name at the bottom left. Large
 * photo cards carry the named shadow and a strong hairline ring.
 */
export function PhotoCard({ uri, label, seat, width, height, radius, accessibilityLabel, style }: PhotoCardProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const placeholder = uri.startsWith(MOCK_PREFIX);
  const blob = width * 1.15;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: seat.tint,
          boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.14)',
        },
        style,
      ]}>
      {placeholder ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`blob${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={seat.color} stopOpacity={0.8} />
              <Stop offset={0.55} stopColor={seat.color} stopOpacity={0.6} />
              <Stop offset={1} stopColor={seat.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={width * 0.25} cy={height * 0.5} r={blob / 2} fill={`url(#blob${id})`} />
        </Svg>
      ) : (
        <Photo uri={uri} hairline={false} style={StyleSheet.absoluteFill} />
      )}
      {/* The photo scrim: the deep canvas at .8 at the foot, clear by half way up. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`scrim${id}`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset={0} stopColor={Velvet.deep} stopOpacity={0.8} />
            <Stop offset={0.5} stopColor={Velvet.deep} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#scrim${id})`} />
      </Svg>
      <ThemedText
        type="headline"
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[styles.label, { color: Velvet.cream, left: radius * 0.7, right: radius * 0.7, bottom: radius * 0.7 }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  label: {
    position: 'absolute',
  },
});
