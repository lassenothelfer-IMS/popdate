import { Asset } from 'expo-asset';
import { StyleSheet, View, type ViewStyle } from 'react-native';

// The file that fits the screen's density (plain, @2x or @3x), shown as a 128 px tile.
const GRAIN = Asset.fromModule(require('../../assets/images/paper-grain.png') as number).uri;

/** The page's paper, on the web: the same grain as a tiled CSS background. See paper-grain.tsx. */
export function PaperGrain() {
  return <View style={[StyleSheet.absoluteFill, tile]} pointerEvents="none" aria-hidden />;
}

// CSS-only properties, which React Native's style types don't know.
const tile = {
  backgroundImage: `url(${GRAIN})`,
  backgroundRepeat: 'repeat',
  backgroundSize: '128px 128px',
} as ViewStyle;
