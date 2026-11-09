import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * The verified mark next to a name: a 14 pt circle in the text color with a
 * 1.6 pt check. Decorative: say "verified" in the name's label.
 */
export function VerifiedCheck({ size = 14 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Circle cx={7} cy={7} r={7} fill={theme.success} />
      <Path
        d="M4.1 7.2l2 2 3.8-4.2"
        stroke={theme.onInverse}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
