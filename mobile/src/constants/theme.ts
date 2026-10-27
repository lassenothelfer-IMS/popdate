/**
 * The Popdate design handoff (design/DESIGN.md). Two themes: romantic mauve
 * (dark, the default; still called Velvet in code) and dusty rose (light;
 * Cream in code). Rose is the accent in both; coral is for destructive only.
 * New York for display, SF Pro for text, Gloock only in the wordmark.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { cubicBezier, Easing } from 'react-native-reanimated';

const velvet = {
  /** Canvas: the screen background, flat. */
  page: '#30262F',
  /** Surface 2, a soft rose: chips, the timer pill, slots, inactive buttons. */
  surface: '#49323D',
  /** Surface 3: pressed surface 2, the toggle track when on. */
  surfacePressed: '#5C4653',
  /** Surface 1: cards, list cells, inputs, option rows, sheets, their chat bubbles. */
  field: '#382C36',
  text: '#F8EDEB',
  textSecondary: '#CDBCC3',
  /** Hints, timestamps, placeholders. */
  textTertiary: '#CDBCC3',
  /** Placeholders and decoration. Same as tertiary. */
  textFaint: '#CDBCC3',
  /** Hairline: card borders, list separators. */
  border: 'rgba(255, 255, 255, 0.08)',
  /** The edge of cards and option rows. */
  outline: 'rgba(255, 255, 255, 0.08)',
  /** Input border: interactive borders, input borders, a ghost seat. */
  borderStrong: 'rgba(217, 154, 163, 0.35)',
  /** The empty ring of a radio or checkbox. */
  control: '#CDBCC3',
  /** Accent: the primary button fill, selected chips, radios and checkboxes, the toggle on, the You tag. */
  inverse: '#D99AA3',
  onInverse: '#30262F',
  /** A light edge for fills that want one. */
  highlight: 'rgba(255, 255, 255, 0.25)',
  /** Accent: the Pop and Match buttons, active progress, the unread dot. */
  accent: '#D99AA3',
  onAccent: '#30262F',
  /** Accent as text: links, text buttons, the back arrow, Save. */
  accentText: '#D99AA3',
  /** Accent soft: error cards, the selected question row. */
  accentWash: '#49323D',
  /** Accent pressed: balloon strings, the caret in answers. */
  gold: '#C5828D',
  /** Inactive: progress segments, the toggle track when off. */
  track: '#5C4653',
  /** Cards that read like paper: the recap card and print mats. */
  paper: '#F8EDEB',
  onPaper: '#30262F',
  /** Coral, for destructive actions and errors only, always with an icon. */
  danger: '#FF9A8C',
  /** Checks for "answered", online status. Never a dot on its own. */
  success: '#7FC9A0',
  successFill: '#7FC9A0',
  /** The dim behind sheets. */
  scrim: 'rgba(48, 38, 47, 0.6)',
  /** Sheets, the tab bar. */
  sheet: '#382C36',
  /** Peach: secondary buttons. */
  secondary: '#F0B5A1',
  onSecondary: '#30262F',
} as const;

const cream: Palette = {
  page: '#FFF9F6',
  surface: '#F7D7C9',
  surfacePressed: '#F4C4AE',
  field: '#FCEDEE',
  text: '#3A2A2A',
  textSecondary: '#7A6262',
  textTertiary: '#7A6262',
  textFaint: '#7A6262',
  border: 'rgba(184, 117, 125, 0.18)',
  outline: 'rgba(184, 117, 125, 0.18)',
  borderStrong: 'rgba(184, 117, 125, 0.35)',
  control: '#7A6262',
  inverse: '#B8757D',
  onInverse: '#FFF9F6',
  highlight: 'rgba(255, 255, 255, 0.25)',
  accent: '#B8757D',
  onAccent: '#FFF9F6',
  accentText: '#B8757D',
  accentWash: '#FCEDEE',
  gold: '#8F5A60',
  track: '#F7D7C9',
  paper: '#FCEDEE',
  onPaper: '#3A2A2A',
  danger: '#CF3A2F',
  success: '#1F7A4C',
  successFill: '#1F7A4C',
  scrim: 'rgba(58, 42, 42, 0.35)',
  sheet: '#FCEDEE',
  secondary: '#F7D7C9',
  onSecondary: '#3A2A2A',
};

export type Palette = { [K in keyof typeof velvet]: string };

/** `dark` is the romantic mauve theme, `light` the dusty rose one. */
export const Colors: { light: Palette; dark: Palette } = { light: cream, dark: velvet };

export type ThemeColor = keyof Palette;

/** Both canvases are flat: the glow and the lamp draw in the canvas color, so they don't show. */
export const CanvasGlow = {
  stops: ['#30262F', '#30262F', '#30262F'],
  offsets: [0, 0.45, 1],
  /** The ellipse: 100% x 45% of the screen, centered at 50% x 62%. */
  rx: 1,
  ry: 0.45,
  cy: 0.62,
} as const;

export const Lamp = {
  color: '#30262F',
  opacity: 0,
  /** 60% x 40% of the screen, centered at 50% x 62%, fading out by 70%. */
  rx: 0.6,
  ry: 0.4,
  cy: 0.62,
  fadeAt: 0.7,
} as const;

/** The dark theme's soft glow behind the hero balloon on the welcome screen. */
export const HeroGlow = { color: '#49323D', opacity: 0.9 } as const;

/** The soft glow under the primary and accent buttons. */
export const ButtonShadow = {
  light: '0 10px 24px -10px rgba(184, 117, 125, 0.55)',
  dark: '0 10px 24px -10px rgba(217, 154, 163, 0.45)',
} as const;

/**
 * The brand balloon's lacquer (wordmark, hero, pop, you), per theme: a radial
 * gradient lit from the top left, its knot, the specular highlight and the rim.
 */
export type Lacquer = {
  stops: readonly (readonly [number, string])[];
  knot: string;
  specular: { color: string; opacity: number };
  rim: { color: string; opacity: number };
};

export const BrandLacquer: { light: Lacquer; dark: Lacquer } = {
  light: {
    stops: [
      [0, '#F2B8B3'],
      [0.38, '#C47F88'],
      [0.8, '#8F5A60'],
      [1, '#5A3238'],
    ],
    knot: '#5A3238',
    specular: { color: '#FFFFFF', opacity: 0.55 },
    rim: { color: '#F4C4AE', opacity: 0.45 },
  },
  dark: {
    stops: [
      [0, '#F6C9CB'],
      [0.38, '#D99AA3'],
      [0.8, '#9E5F6C'],
      [1, '#49323D'],
    ],
    knot: '#49323D',
    specular: { color: '#FFFFFF', opacity: 0.55 },
    rim: { color: '#F0B5A1', opacity: 0.45 },
  },
};

/**
 * Raw colors for the few places that are the same in both themes: text and
 * glass over photos. Screens use the palette above.
 */
export const Velvet = {
  deep: '#30262F',
  base: '#382C36',
  lift: '#49323D',
  plush: '#5C4653',
  cream: '#F8EDEB',
  gold: '#C5828D',
  goldOnPaper: '#8F5A60',
  paper: '#F8EDEB',
  faint: '#CDBCC3',
} as const;

/** Dark glass over photos: the "Photo n" tag, the info panel, the page dots. */
export const PhotoGlass = {
  tag: 'rgba(48, 38, 47, 0.55)',
  info: 'rgba(48, 38, 47, 0.85)',
  scrim: 'rgba(48, 38, 47, 0.8)',
  dot: 'rgba(248, 237, 235, 0.4)',
} as const;

/**
 * A player's balloon. `color` is the mid tone: their dot, initial and popped
 * mark; `hi` and `shadow` finish the gradient and `knot` is the knot. `tint` is
 * their photo tile (a placeholder until real photos); `onInk` is the hue as it
 * reads on the primary button, like the balloon in "Pop Sara's balloon".
 */
export type Seat = {
  name: 'gold' | 'coral' | 'blush' | 'garnet' | 'crimson';
  color: string;
  hi: string;
  shadow: string;
  knot: string;
  /** The highlight's opacity. */
  shine: number;
  tint: string;
  onInk: string;
};

/** Seat order is join order: gold, coral, blush, garnet, crimson. You are crimson, the last. */
const balloons = [
  { name: 'gold', color: '#E2B566', hi: '#FFF3D6', shadow: '#6A4212', knot: '#6A4212', shine: 0.5 },
  { name: 'coral', color: '#DD6A60', hi: '#FFC9B6', shadow: '#6E1A25', knot: '#6E1A25', shine: 0.5 },
  { name: 'blush', color: '#E6A3A2', hi: '#FCE0D8', shadow: '#7C3341', knot: '#7C3341', shine: 0.5 },
  { name: 'garnet', color: '#8E1430', hi: '#E57A8E', shadow: '#2E020B', knot: '#2E020B', shine: 0.5 },
  { name: 'crimson', color: '#C21F35', hi: '#FF9A92', shadow: '#4A030F', knot: '#4A030F', shine: 0.5 },
] as const;

/** Photo tint tiles, in the same order as the balloons. */
const tints = {
  dark: ['#5A4320', '#5A2F3F', '#4A2F45', '#2F4458', '#30452E'],
  light: ['#EFE3D0', '#E8D6DF', '#E8DEE6', '#DDE4EA', '#DFE6DB'],
} as const;

export const SeatColors: { light: readonly Seat[]; dark: readonly Seat[] } = {
  dark: balloons.map((b, i) => ({ ...b, tint: tints.dark[i], onInk: b.shadow })),
  light: balloons.map((b, i) => ({ ...b, tint: tints.light[i], onInk: b.hi })),
};

/** The brand balloon (wordmark, hero, pop) is crimson in both themes. */
export const BrandBalloon = SeatColors.dark[4];

/** The gradient stops for a balloon color, when it is one of the five. */
export function lacquerFor(color: string): Seat | undefined {
  const key = color.toLowerCase();
  return SeatColors.dark.find((seat) => seat.color.toLowerCase() === key);
}

/**
 * Display is New York, the iOS system serif (the mockups' Fraunces is a
 * stand-in). Text is SF Pro, the system font. Gloock is the wordmark only.
 * Android falls back to its system serif and sans; the web to the same stacks.
 */
export const Fonts = {
  serif: Platform.select({ ios: 'ui-serif', android: 'serif', default: 'ui-serif, "New York", Georgia, serif' }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif',
  }),
  wordmark: 'Gloock',
} as const;

/** 8pt grid with 4pt half steps. */
export const Space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Side margin of every screen. */
export const Gutter = 20;

export const Radius = {
  /** Checkboxes. */
  xs: 7,
  /** A photo inside a card. */
  sm: 10,
  /** Inputs, option rows, photo tiles. */
  md: 12,
  /** Small cards. */
  lg: 14,
  /** The primary, coral and secondary buttons; large cards. */
  xl: 16,
  /** Photo cards. */
  card: 22,
  /** The top corners of a bottom sheet. */
  sheet: 28,
  pill: 999,
} as const;

/** Every photo is portrait 3:4. */
export const PhotoAspect = 3 / 4;

/** Durations in ms (DESIGN.md section 7). Nothing else moves. */
export const Motion = {
  press: 180,
  state: 180,
  enter: 250,
  exit: 200,
  burst: 300,
  /** Each top-level block of a screen rises in over this long. */
  entrance: 760,
  /** And starts this long after the one before it, from 40 ms. */
  stagger: 70,
  /** How long the room holds after a pop before the next phase. */
  hold: 1200,
} as const;

/** Worklet easings for timing animations. Never ease-in on UI. */
export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** Screen entrances and presses: cubic-bezier(.22, 1, .36, 1). */
  rise: Easing.bezier(0.22, 1, 0.36, 1),
  /** Sheets: cubic-bezier(.32, .72, 0, 1). */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** The same curves for Reanimated CSS transitions and keyframes. */
export const CssEase = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
  rise: cubicBezier(0.22, 1, 0.36, 1),
} as const;

/** Smallest comfortable touch target, in points. */
export const MinTouch = 44;

export const MaxContentWidth = 560;
