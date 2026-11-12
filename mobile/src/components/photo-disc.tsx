import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * The light tint that keeps dark ink readable when the glass sits on a dark
 * photo: untinted glass takes on what is under it, and the icon disappears.
 */
export const PHOTO_GLASS_TINT = 'rgba(255, 253, 254, 0.7)';

/** Real glass only where the system draws it (iOS 26). */
export const photoGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * What a round control over a photo stands on. Put it first inside the
 * pressable, which stays transparent: on iOS 26 it is Liquid Glass that
 * answers the touch, everywhere else the page color.
 */
export function PhotoDisc({ radius }: { radius: number }) {
  const theme = useTheme();
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius }];
  if (!photoGlass) return <View pointerEvents="none" style={[shape, { backgroundColor: theme.page }]} />;
  return (
    <GlassView
      isInteractive
      glassEffectStyle="regular"
      colorScheme="light"
      tintColor={PHOTO_GLASS_TINT}
      style={shape}
    />
  );
}
