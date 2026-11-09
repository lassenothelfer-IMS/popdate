/**
 * The Popdate design handoff (design/DESIGN.md), in one light palette. Black does
 * the work (buttons, selection, progress) and plum is the brand, kept for the
 * balloon, the wordmark, the paywall and tiny badges; destructive red is for
 * destructive actions only, and teal is for success.
 * New York for display, SF Pro for text, Gloock only in the wordmark.
 */

import '@/global.css';

import { Platform } from 'react-native';
import { cubicBezier, Easing } from 'react-native-reanimated';

/** The palette's raw colors. Screens read the semantic keys below. */
const Ink = {
  background: '#FFFDFE',
  surface1: '#F3F0F1',
  surface2: '#EBE8E9',
  surface3: '#E5E2E3',
  textPrimary: '#191919',
  textSecondary: '#5F5F5F',
  textTertiary: '#818181',
  /** The brand plum. */
  brand: '#5D2355',
  /** The brand balloon's knot and string. */
  brandDeep: '#2C0B28',
  brandTint: 'rgba(93, 35, 85, 0.1)',
  /** The text color at 6%: selected fills and icon circles. */
  inkTint: 'rgba(25, 25, 25, 0.06)',
  onAccent: '#FFFDFE',
  hairline: 'rgba(25, 25, 25, 0.1)',
  /** The outline of a secondary button. */
  outline: 'rgba(25, 25, 25, 0.18)',
  success: '#0D6765',
  destructive: '#B02A3A',
} as const;

const light = {
  /** Canvas: the screen background, flat. */
  page: Ink.background,
  /** Surface 2: chips, the timer pill, slots, inactive buttons. */
  surface: Ink.surface2,
  /** Pressed surface 2 (pressed rows on surface 1 use it too), so a press always shows. */
  surfacePressed: Ink.surface3,
  /** Surface 1: cards, list cells, inputs, option rows, their chat bubbles. */
  field: Ink.surface1,
  text: Ink.textPrimary,
  textSecondary: Ink.textSecondary,
  /** Hints, timestamps, placeholders. */
  textTertiary: Ink.textTertiary,
  /** Placeholders and decoration. Same as tertiary. */
  textFaint: Ink.textTertiary,
  /** Hairline: card borders, list separators. */
  border: Ink.hairline,
  /** The edge of cards and option rows. */
  outline: Ink.hairline,
  /** Input borders, dividers on surfaces, a ghost seat. */
  borderStrong: Ink.surface3,
  /** The empty ring of a radio or checkbox. */
  control: Ink.textTertiary,
  /** Selected chips, radios and checkboxes, the You tag. */
  inverse: Ink.textPrimary,
  onInverse: Ink.onAccent,
  /** A light edge for fills that want one. */
  highlight: 'rgba(255, 255, 255, 0.25)',
  /** Accent: primary buttons, active progress, the toggle on. Black, like the text. */
  accent: Ink.textPrimary,
  onAccent: Ink.onAccent,
  /** Links and text buttons. */
  accentText: Ink.textPrimary,
  /** Selected fills, icon circles. */
  accentWash: Ink.inkTint,
  /** The brand plum: the brand balloon, the wordmark dot, the paywall, Pop, tiny badges. Nowhere else. */
  brand: Ink.brand,
  onBrand: Ink.onAccent,
  /** The brand balloon's knot and string. */
  brandDeep: Ink.brandDeep,
  /** The brand plum at 10%, behind the paywall's selected plan. */
  brandWash: Ink.brandTint,
  /** Balloon strings, the caret in answers. */
  gold: Ink.textPrimary,
  /** Inactive: progress segments, the toggle track when off. */
  track: Ink.surface2,
  /** Cards that read like paper: the recap card and print mats. */
  paper: Ink.surface1,
  onPaper: Ink.textPrimary,
  /** Destructive actions and errors only, always with an icon. */
  danger: Ink.destructive,
  /** Checks for "answered", verified, online status. Never a dot on its own. */
  success: Ink.success,
  successFill: Ink.success,
  /** The dim behind sheets: the text color at 35%. */
  scrim: 'rgba(25, 25, 25, 0.35)',
  /** Sheets, the tab bar. */
  sheet: Ink.surface1,
  /** Secondary buttons: the page with an outline. */
  secondary: Ink.background,
  onSecondary: Ink.textPrimary,
  secondaryEdge: Ink.outline,
} as const;

export type Palette = { [K in keyof typeof light]: string };

/** The one palette: light. */
export const Colors: Palette = light;

export type ThemeColor = keyof Palette;

/**
 * Raw colors for text and glass over photos, the same on every screen.
 * Screens use the palette above.
 */
export const Velvet = {
  deep: Ink.textPrimary,
  cream: Ink.onAccent,
  /** Secondary text over dark glass: the light text at 72%. */
  faint: 'rgba(255, 253, 254, 0.72)',
} as const;

/** Dark glass over photos: the "Photo n" tag, the info panel, the page dots. */
export const PhotoGlass = {
  tag: 'rgba(25, 25, 25, 0.55)',
  info: 'rgba(25, 25, 25, 0.85)',
  scrim: 'rgba(25, 25, 25, 0.8)',
  dot: 'rgba(255, 253, 254, 0.4)',
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
const tints = ['#EFE3D0', '#E8D6DF', '#E8DEE6', '#DDE4EA', '#DFE6DB'] as const;

export const SeatColors: readonly Seat[] = balloons.map((b, i) => ({ ...b, tint: tints[i], onInk: b.hi }));

/** The brand balloon (wordmark, hero, pop) is crimson. */
export const BrandBalloon = SeatColors[4];

/** The gradient stops for a balloon color, when it is one of the five. */
export function lacquerFor(color: string): Seat | undefined {
  const key = color.toLowerCase();
  return SeatColors.find((seat) => seat.color.toLowerCase() === key);
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
  /** Fraunces italic 400: only the "Plus" after the wordmark on the Popdate+ paywall. */
  plus: 'Fraunces-Italic',
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
