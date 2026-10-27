import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { BrandLacquer, Colors, MinTouch } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

/** The balloon in the 120 x 134 box the logo is drawn in. */
const BODY =
  'M60 7.5C31 7.5 12.5 30 12.5 58c0 32 25 57 42 61.5h11c17-4.5 42-29.5 42-61.5C107.5 30 89 7.5 60 7.5z';
const KNOT = 'M52 118h16l-8 12z';

/** "Popdate" as Gloock glyph outlines, never retyped in the font. The "o" is the balloon. */
const GLYPHS = [
  'M0 0V-10Q36 -10 58.0 -32.0Q80 -54 80 -90V-660Q80 -696 58.0 -718.0Q36 -740 0 -740V-750H334Q411 -749 468.5 -723.5Q526 -698 558.5 -653.0Q591 -608 591 -547Q591 -486 558.5 -440.5Q526 -395 466.5 -369.5Q407 -344 326 -344H234V-90Q234 -54 256.0 -32.0Q278 -10 314 -10H316V0ZM234 -357H293Q336 -357 367.5 -381.5Q399 -406 416.5 -449.0Q434 -492 434 -547Q434 -602 416.5 -645.0Q399 -688 367.0 -712.5Q335 -737 292 -737H234Z',
  'M1071.0 210V200H1072.0Q1108.0 200 1130.0 178.0Q1152.0 156 1152.0 120V-418Q1151.0 -462 1133.0 -480.0Q1115.0 -498 1071.0 -498V-508H1170.0Q1229.0 -508 1251.0 -519.0Q1273.0 -530 1283.0 -546H1293.0L1294.0 -418Q1317.0 -463 1364.0 -493.0Q1411.0 -523 1463.0 -523Q1519.0 -523 1562.0 -489.0Q1605.0 -455 1629.5 -396.5Q1654.0 -338 1654.0 -262Q1654.0 -178 1624.0 -116.0Q1594.0 -54 1539.5 -20.0Q1485.0 14 1410.0 14Q1369.0 14 1343.0 1.5Q1317.0 -11 1296.0 -40V120Q1296.0 156 1318.0 178.0Q1340.0 200 1376.0 200H1377.0V210ZM1389.0 -3Q1443.0 -3 1471.0 -70Q1498.0 -138 1498.0 -265Q1498.0 -483 1410.0 -483Q1376.0 -483 1343.0 -456.0Q1310.0 -429 1296.0 -390V-157Q1296.0 -85 1321.0 -44.0Q1346.0 -3 1389.0 -3Z',
  'M2053.0 38 2052.0 -104Q2028.0 -52 1980.0 -18.5Q1932.0 15 1877.0 15Q1823.0 15 1780.0 -19.0Q1737.0 -53 1712.0 -112.5Q1687.0 -172 1687.0 -247Q1687.0 -331 1718.5 -393.0Q1750.0 -455 1806.0 -488.5Q1862.0 -522 1935.0 -522Q1976.0 -522 2002.0 -509.5Q2028.0 -497 2049.0 -467V-660Q2049.0 -696 2026.5 -718.0Q2004.0 -740 1968.0 -740V-750H2070.0Q2120.0 -750 2146.0 -760.0Q2172.0 -770 2183.0 -788H2193.0V-90Q2193.0 -54 2215.0 -32.0Q2237.0 -10 2274.0 -10V0H2172.0Q2128.0 0 2102.5 9.0Q2077.0 18 2063.0 38ZM1932.0 -25Q1955.0 -25 1978.5 -39.5Q2002.0 -54 2021.0 -78.0Q2040.0 -102 2049.0 -129V-373Q2044.0 -433 2019.5 -469.0Q1995.0 -505 1956.0 -505Q1904.0 -505 1875.0 -439Q1847.0 -373 1847.0 -244Q1847.0 -25 1932.0 -25Z',
  'M2388.0 14Q2327.0 14 2290.0 -19.0Q2253.0 -52 2253.0 -106Q2253.0 -129 2261.0 -149.5Q2269.0 -170 2291.0 -190Q2314.0 -210 2354.0 -231.5Q2394.0 -253 2460.0 -277L2553.0 -311V-386Q2553.0 -443 2535.0 -476.5Q2517.0 -510 2485.0 -510Q2447.0 -509 2420.5 -460.0Q2394.0 -411 2385.0 -324L2277.0 -386Q2294.0 -427 2329.0 -458.0Q2364.0 -489 2409.5 -506.0Q2455.0 -523 2505.0 -523Q2590.0 -523 2643.5 -475.5Q2697.0 -428 2697.0 -346V-105Q2697.0 -47 2736.0 -47Q2759.0 -47 2781.0 -72L2789.0 -65Q2763.0 -30 2726.0 -8.0Q2689.0 14 2654.0 14Q2616.0 14 2588.5 -12.0Q2561.0 -38 2554.0 -81Q2505.0 -31 2468.5 -8.5Q2432.0 14 2388.0 14ZM2463.0 -48Q2485.0 -48 2505.5 -59.0Q2526.0 -70 2552.0 -95L2553.0 -298L2513.0 -283Q2462.0 -264 2435.0 -244.5Q2408.0 -225 2397.5 -201.0Q2387.0 -177 2387.0 -146Q2387.0 -103 2408.5 -75.5Q2430.0 -48 2463.0 -48Z',
  'M2955.0 14Q2903.0 14 2870.0 -19.0Q2837.0 -52 2837.0 -105V-490H2752.0V-503Q2821.0 -508 2875.5 -547.0Q2930.0 -586 2965.0 -652H2981.0V-508H3114.0L3104.0 -490H2981.0V-127Q2981.0 -47 3035.0 -47Q3053.0 -47 3076.5 -58.0Q3100.0 -69 3121.0 -87V-77Q3088.0 -35 3043.0 -10.5Q2998.0 14 2955.0 14Z',
  'M3368.0 12Q3299.0 12 3245.5 -22.0Q3192.0 -56 3162.0 -116.5Q3132.0 -177 3132.0 -255Q3132.0 -335 3165.0 -395.0Q3198.0 -455 3255.5 -488.5Q3313.0 -522 3386.0 -522Q3447.0 -522 3494.5 -498.0Q3542.0 -474 3570.5 -430.5Q3599.0 -387 3603.0 -330L3604.0 -315H3268.0V-310Q3268.0 -204 3315.0 -140.5Q3362.0 -77 3441.0 -77Q3489.0 -77 3532.5 -100.5Q3576.0 -124 3603.0 -164L3612.0 -161Q3595.0 -110 3559.0 -71.0Q3523.0 -32 3474.0 -10.0Q3425.0 12 3368.0 12ZM3269.0 -330H3472.0Q3472.0 -409 3446.5 -458.0Q3421.0 -507 3375.0 -507Q3331.0 -507 3302.0 -459.0Q3273.0 -411 3269.0 -330Z',
];

/** The box is 1.11 em tall: the glyphs plus the string below the baseline. */
const EM_HEIGHT = 1.11;

/**
 * "Popdate" where the "o" is the rose lacquer balloon whose string hangs
 * below the baseline. Small on purpose: the content leads.
 */
type WordmarkProps = {
  /** The font size in points: 20 in headers, 16 on the recap card, 15 in the Live Activity. */
  size?: number;
  /** Draw in one theme whatever the app's theme is, like the recap card, which is always Cream. */
  tone?: 'velvet' | 'cream';
};

export function Wordmark({ size = 20, tone }: WordmarkProps) {
  const current = useTheme();
  const scheme = useScheme();
  const mode = tone ? (tone === 'cream' ? 'light' : 'dark') : scheme;
  const theme = tone ? Colors[mode] : current;
  // The same rose lacquer as the hero balloon; the string is the accent pressed.
  const lacquer = BrandLacquer[mode];
  const height = size * EM_HEIGHT;
  const width = (height * 3676) / 1110;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Popdate">
      <Svg width={width} height={height} viewBox="-20 -750 3676 1110">
        <Defs>
          <RadialGradient id="wordmarkBalloon" cx="34%" cy="26%" r="78%">
            {lacquer.stops.map(([offset, stop]) => (
              <Stop key={offset} offset={offset} stopColor={stop} />
            ))}
          </RadialGradient>
        </Defs>
        {GLYPHS.map((d, i) => (
          <Path key={i} d={d} fill={theme.text} />
        ))}
        <G transform="translate(593.0 -603.0) scale(4.3333)">
          <Path
            d="M60 130c-6 20 10 34 2 52s-14 22-4 36"
            stroke={theme.gold}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
          <Path d={BODY} fill="url(#wordmarkBalloon)" />
          <Path d={KNOT} fill={lacquer.knot} />
          <Ellipse
            cx={40}
            cy={36}
            rx={8}
            ry={15}
            rotation={-28}
            origin="40, 36"
            fill={lacquer.specular.color}
            opacity={lacquer.specular.opacity}
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouch,
    alignSelf: 'flex-start',
  },
});
