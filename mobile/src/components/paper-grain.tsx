import { Image, StyleSheet } from 'react-native';

const GRAIN = require('../../assets/images/paper-grain.png') as number;

/**
 * The page's paper: a fine grain tiled over the page color, under everything
 * else on the screen. It is faint on purpose (about 2% on average), so a chip or
 * card filled with the page color still sits flush on it. A still image: nothing
 * moves, and it costs one layer per screen. Put it first inside a page's root.
 */
export function PaperGrain() {
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
