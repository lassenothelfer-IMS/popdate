/**
 * The Popdate design handoff (design/DESIGN.md): a small candlelit room. Two
 * themes, "Velvet" (dark, the default) and "Cream" (light). Quiet everywhere,
 * one loud moment: the pop. Coral is for that moment only, one fill per screen.
 * New York for display, SF Pro for text, Gloock only in the wordmark.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { cubicBezier, Easing } from 'react-native-reanimated';

const velvet = {
  /** Canvas: the screen background. Velvet screens draw the canvas glow and lamp over it. */
  page: '#1D070E',
  /** Surface 2: chips, secondary buttons, the timer pill, slots, inactive buttons. */
  surface: '#3B141A',
  /** Surface 3: pressed surface 2, the toggle track when on. */
  surfacePressed: '#4A1E21',
  /** Surface 1: cards, list cells, inputs, option rows, their chat bubbles. */
  field: '#2B0D14',
  text: '#F6EAE6',
  textSecondary: '#D3B5B5',
  /** Hints, timestamps, placeholders. Never for information you must read. */
  textTertiary: '#A98A8D',
  /** Placeholders and decoration. Same as tertiary: the design has no fainter tone. */
  textFaint: '#A98A8D',
  /** Hairline: card borders, list separators. */
  border: 'rgba(255, 255, 255, 0.08)',
  /** The edge of cards and option rows. */
  outline: 'rgba(255, 255, 255, 0.08)',
  /** Hairline strong: interactive borders, input borders, a ghost seat. */
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  /** The empty ring of a radio or checkbox. */
  control: '#A98A8D',
  /** The primary button fill, selected chips and radios, the You tag. */
  inverse: '#F6EAE6',
  onInverse: '#1D070E',
  /** The light edge along the top of the primary button. */
  highlight: 'rgba(255, 255, 255, 0.9)',
  /** Coral: the Pop and Match buttons, the unread dot. At most one coral fill per screen. */
  accent: '#F0695C',
  onAccent: '#1D070E',
  /** Coral text: links, Save, "Write your own", report links. */
  accentText: '#FF9A8C',
  /** Accent soft: error cards, the selected question row. */
  accentWash: '#52222A',
  /** Balloon strings, Live Activity progress. */
  gold: '#E9BE72',
  /** Inactive progress segments, the toggle track when off. */
  track: '#562627',
  /** Cards that read like paper: the recap card and print mats. */
  paper: '#F6EAE6',
  onPaper: '#1D070E',
  /** Errors are quiet: coral text on an accent-soft card, always with an icon. */
  danger: '#FF9A8C',
  /** Checks for "answered", online status. Never a dot on its own. */
  success: '#7FC9A0',
  successFill: '#7FC9A0',
  /** The dim behind sheets. */
  scrim: 'rgba(29, 7, 14, 0.6)',
  /** Sheets, the tab bar. */
  sheet: '#2B0D14',
} as const;

const cream: Palette = {
  page: '#F3E9DA',
  surface: '#E9DDC8',
  surfacePressed: '#DCCDB6',
  field: '#FFFDFA',
  text: '#1C1917',
  textSecondary: '#5F574F',
  textTertiary: '#8C8378',
  textFaint: '#8C8378',
  border: 'rgba(28, 25, 23, 0.08)',
  outline: 'rgba(28, 25, 23, 0.08)',
  borderStrong: 'rgba(28, 25, 23, 0.14)',
  control: '#8C8378',
  inverse: '#1C1917',
  onInverse: '#FFFDFA',
  highlight: 'rgba(255, 253, 250, 0.16)',
  accent: '#CF3A2F',
  onAccent: '#FFFDFA',
  accentText: '#B5332A',
  accentWash: '#F5E1DC',
  gold: '#9A6A26',
  track: '#D6C9B3',
  paper: '#FFFDFA',
  onPaper: '#1C1917',
  danger: '#B5332A',
  success: '#1F7A4C',
  successFill: '#1F7A4C',
  scrim: 'rgba(28, 25, 23, 0.35)',
  sheet: '#FFFDFA',
};

export type Palette = { [K in keyof typeof velvet]: string };

/** `dark` is Velvet, `light` is Cream. */
export const Colors: { light: Palette; dark: Palette } = { light: cream, dark: velvet };

export type ThemeColor = keyof Palette;

/**
 * The two named gradients, Velvet only (Cream is a flat canvas). The canvas
 * glow sits under every full screen; the lamp lies over it and breathes.
 */
export const CanvasGlow = {
  stops: ['#4A1E21', '#2E0D14', '#1D070E'],
  offsets: [0, 0.45, 1],
  /** The ellipse: 100% x 45% of the screen, centered at 50% x 62%. */
  rx: 1,
  ry: 0.45,
  cy: 0.62,
} as const;

export const Lamp = {
  color: 'rgb(255, 138, 110)',
  opacity: 0.16,
  /** 60% x 40% of the screen, centered at 50% x 62%, fading out by 70%. */
  rx: 0.6,
  ry: 0.4,
  cy: 0.62,
  fadeAt: 0.7,
} as const;

/**
 * Raw handoff colors, for the few places that are the same in both themes
 * (the brand balloon, photo scrims). Screens use the palette above.
 */
export const Velvet = {
  deep: '#1D070E',
  base: '#2E0D14',
  lift: '#4A1E21',
  plush: '#3B141A',
  cream: '#F6EAE6',
  gold: '#E9BE72',
  goldOnPaper: '#9A6A26',
  paper: '#F6EAE6',
  faint: '#A98A8D',
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
