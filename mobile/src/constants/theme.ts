/**
 * The Popdate design handoff (design/DESIGN.md), recolored "wine and sand": a
 * warm charcoal dark theme (the default; still called Velvet in code) and a
 * sand light theme (Cream in code). Wine is the one accent; coral is for
 * destructive only.
 * New York for display, SF Pro for text, Gloock only in the wordmark.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { cubicBezier, Easing } from 'react-native-reanimated';

const velvet = {
  /** Canvas: the screen background, flat. */
  page: '#2B2527',
  /** Surface 2, a soft rose: chips, the timer pill, slots, inactive buttons. */
  surface: '#40373A',
  /** Surface 3: pressed surface 2, the toggle track when on. */
  surfacePressed: '#4B4145',
  /** Surface 1: cards, list cells, inputs, option rows, sheets, their chat bubbles. */
  field: '#352E31',
  text: '#F3EDE7',
  textSecondary: '#C9BDB8',
  /** Hints, timestamps, placeholders. */
  textTertiary: '#C9BDB8',
  /** Placeholders and decoration. Same as tertiary. */
  textFaint: '#C9BDB8',
  /** Hairline: card borders, list separators. */
  border: 'rgba(255, 255, 255, 0.09)',
  /** The edge of cards and option rows. */
  outline: 'rgba(255, 255, 255, 0.09)',
  /** Input border: interactive borders, input borders, a ghost seat. */
  borderStrong: 'rgba(208, 130, 138, 0.35)',
  /** The empty ring of a radio or checkbox. */
  control: '#C9BDB8',
  /** Ink: selected chips, radios and checkboxes, the You tag. Primary buttons use the accent. */
  inverse: '#F3EDE7',
  onInverse: '#2B2527',
  /** A light edge for fills that want one. */
  highlight: 'rgba(255, 255, 255, 0.25)',
  /** Accent: primary buttons, Pop and Match, active progress, the toggle on, the unread dot. */
  accent: '#D0828A',
  onAccent: '#2B2527',
  /** Accent as text, sparingly: Save, "Write your own". Links and text buttons use the text tones. */
  accentText: '#D0828A',
  /** Accent soft: error cards, the selected question row. */
  accentWash: '#43343A',
  /** Accent pressed: balloon strings, the caret in answers. */
  gold: '#B86C74',
  /** Inactive: progress segments, the toggle track when off. */
  track: '#4B4145',
  /** Cards that read like paper: the recap card and print mats. */
  paper: '#F3EDE7',
  onPaper: '#2B2527',
  /** Coral, for destructive actions and errors only, always with an icon. */
  danger: '#FF9A8C',
  /** Checks for "answered", online status. Never a dot on its own. */
  success: '#7FC9A0',
  successFill: '#7FC9A0',
  /** The dim behind sheets. */
  scrim: 'rgba(20, 16, 18, 0.6)',
  /** Sheets, the tab bar. */
  sheet: '#352E31',
  /** Peach: secondary buttons. */
  secondary: '#40373A',
  onSecondary: '#F3EDE7',
} as const;

const cream: Palette = {
  page: '#F6F1EA',
  surface: '#EFE7DC',
  surfacePressed: '#E6DCCE',
  field: '#FFFDF9',
  text: '#2A2222',
  textSecondary: '#6E625E',
  textTertiary: '#6E625E',
  textFaint: '#6E625E',
  border: 'rgba(42, 34, 34, 0.1)',
  outline: 'rgba(42, 34, 34, 0.1)',
  borderStrong: 'rgba(42, 34, 34, 0.18)',
  control: '#6E625E',
  inverse: '#2A2222',
  onInverse: '#FFFDF9',
  highlight: 'rgba(255, 255, 255, 0.25)',
  accent: '#7A2E3A',
  onAccent: '#FFFDF9',
  accentText: '#7A2E3A',
  accentWash: '#F3E4E1',
  gold: '#5E2230',
  track: '#E6DCCE',
  paper: '#FFFDF9',
  onPaper: '#2A2222',
  danger: '#B23A2E',
  success: '#1F7A4C',
  successFill: '#1F7A4C',
  scrim: 'rgba(42, 34, 34, 0.35)',
  sheet: '#FFFDF9',
  secondary: '#EADFD2',
  onSecondary: '#2A2222',
};

export type Palette = { [K in keyof typeof velvet]: string };

/** `dark` is warm charcoal with rose-wine, `light` is sand with deep wine. */
export const Colors: { light: Palette; dark: Palette } = { light: cream, dark: velvet };

export type ThemeColor = keyof Palette;

/** Both canvases are flat: the glow and the lamp draw in the canvas color, so they don't show. */
export const CanvasGlow = {
  stops: ['#2B2527', '#2B2527', '#2B2527'],
  offsets: [0, 0.45, 1],
  /** The ellipse: 100% x 45% of the screen, centered at 50% x 62%. */
  rx: 1,
  ry: 0.45,
  cy: 0.62,
} as const;

export const Lamp = {
  color: '#2B2527',
  opacity: 0,
  /** 60% x 40% of the screen, centered at 50% x 62%, fading out by 70%. */
  rx: 0.6,
  ry: 0.4,
  cy: 0.62,
  fadeAt: 0.7,
} as const;

/** The dark theme's soft glow behind the hero balloon on the welcome screen. */
export const HeroGlow = { color: '#40373A', opacity: 0.9 } as const;

/** The soft glow under the primary and accent buttons. */
export const ButtonShadow = {
  light: '0 10px 24px -10px rgba(122, 46, 58, 0.45)',
  dark: '0 10px 24px -10px rgba(208, 130, 138, 0.35)',
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
      [0, '#E8A3A6'],
      [0.38, '#9E3E4A'],
      [0.8, '#6A2632'],
      [1, '#3E1820'],
    ],
    knot: '#3E1820',
    specular: { color: '#FFFFFF', opacity: 0.55 },
    rim: { color: '#E6C9A8', opacity: 0.45 },
  },
  dark: {
    stops: [
      [0, '#F2BDBF'],
      [0.38, '#C9737B'],
      [0.8, '#8C3F4A'],
      [1, '#4A2A31'],
    ],
    knot: '#4A2A31',
    specular: { color: '#FFFFFF', opacity: 0.55 },
    rim: { color: '#E9CFA9', opacity: 0.45 },
  },
};

/**
 * Raw colors for the few places that are the same in both themes: text and
 * glass over photos. Screens use the palette above.
 */
export const Velvet = {
  deep: '#2B2527',
  base: '#352E31',
  lift: '#40373A',
  plush: '#4B4145',
  cream: '#F3EDE7',
  gold: '#B86C74',
  goldOnPaper: '#5E2230',
  paper: '#F3EDE7',
  faint: '#C9BDB8',
} as const;

/** Dark glass over photos: the "Photo n" tag, the info panel, the page dots. */
export const PhotoGlass = {
  tag: 'rgba(30, 24, 26, 0.55)',
  info: 'rgba(30, 24, 26, 0.85)',
  scrim: 'rgba(30, 24, 26, 0.8)',
  dot: 'rgba(243, 237, 231, 0.4)',
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
