/**
 * "Evening salon": one lamp, lacquer and velvet. Paper and ink by day, a warm
 * near black by night, Gloock for people's words and the few big lines, Hanken
 * Grotesk for everything you read to act. Red only where something pops.
 * Every text pair below meets WCAG 4.5:1 in its own mode (3:1 for graphics).
 */

import '@/global.css';

import { cubicBezier, Easing } from 'react-native-reanimated';

const light = {
  /** Page background: warm paper. */
  page: '#F6F2EB',
  /** Chips, slots, pills, the timer, inactive buttons. */
  surface: '#EDE7DD',
  /** Pressed rows, empty progress segments, the sheet grabber. */
  surfacePressed: '#E4DCD0',
  /** The raised layer: inputs, option rows, cards. */
  field: '#FFFDFA',
  text: '#1C1917',
  textSecondary: '#5F574F',
  /** Quiet labels. Darker than the canvas's #8C8378, which reads 3.3:1 on paper. */
  textTertiary: '#756C62',
  /** Hairline separators. */
  border: 'rgba(28, 25, 23, 0.08)',
  /** The edge of inputs, option rows and cards. */
  outline: 'rgba(28, 25, 23, 0.08)',
  /** A selected or focused edge, a ghost seat. */
  borderStrong: 'rgba(28, 25, 23, 0.18)',
  /** The empty ring of a radio or checkbox: 3:1 on field and surface, so it reads as a control. */
  control: 'rgba(28, 25, 23, 0.56)',
  /** Ink: every big button, selected chips and radios, the You tag. */
  inverse: '#1C1917',
  onInverse: '#F6F2EB',
  /** Lacquer: a 1pt light edge along the top of ink buttons. */
  highlight: 'rgba(255, 253, 250, 0.16)',
  /** Pop red, as a fill: the brand balloon. */
  accent: '#CF3A2F',
  onAccent: '#FFFDFA',
  /** Pop red, as text and rings: You asked, the marked ring, the picked question, errors. */
  accentText: '#B5332A',
  /** Behind the picked question and your photo while it's showing. */
  accentWash: '#F5E1DC',
  /** Errors share pop red's text shade, always with an icon. */
  danger: '#B5332A',
  success: '#1F7A4C',
  /** The answered check. */
  successFill: '#30A46C',
  scrim: 'rgba(28, 25, 23, 0.28)',
  /** Bottom sheets. */
  sheet: '#FFFDFA',
} as const;

const dark = {
  page: '#141210',
  surface: '#26221F',
  surfacePressed: '#302B27',
  field: '#1C1917',
  text: '#F3EEE7',
  textSecondary: '#B9B0A5',
  /** A step up from the canvas's #857C72, which reads 4.3:1 on cards. */
  textTertiary: '#8E857B',
  border: 'rgba(255, 255, 255, 0.07)',
  outline: 'rgba(255, 255, 255, 0.11)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',
  control: 'rgba(255, 255, 255, 0.38)',
  inverse: '#F3EEE7',
  onInverse: '#1C1917',
  highlight: 'transparent',
  accent: '#F0695C',
  onAccent: '#1C1917',
  accentText: '#F2766A',
  accentWash: '#33201D',
  danger: '#F2766A',
  success: '#4FB07A',
  successFill: '#4FB07A',
  scrim: 'rgba(10, 8, 7, 0.55)',
  sheet: '#26221F',
} as const;

export type Palette = { [K in keyof typeof light]: string };

export const Colors: { light: Palette; dark: Palette } = { light, dark };

export type ThemeColor = keyof Palette;

/**
 * A player's hue. `color` draws their balloon, dot and initial; `tint` is the
 * ground behind their photo placeholder; `onInk` is the same hue lifted (or
 * deepened) so it reads on an ink button, like the balloon in "Pop Sara's balloon".
 */
export type Seat = {
  name: 'rose' | 'ochre' | 'slate' | 'moss' | 'plum';
  color: string;
  tint: string;
  onInk: string;
};

/** One hue per seat, in seat order. None of them is pop red. */
export const SeatColors: { light: readonly Seat[]; dark: readonly Seat[] } = {
  light: [
    { name: 'rose', color: '#B25A68', tint: '#F4E6E6', onInk: '#E39AA6' },
    { name: 'ochre', color: '#B07E26', tint: '#F4EBDC', onInk: '#D9AE5C' },
    { name: 'slate', color: '#4A6A8A', tint: '#E6E8EA', onInk: '#8FAECB' },
    { name: 'moss', color: '#587554', tint: '#E8EAE3', onInk: '#9BBB8F' },
    { name: 'plum', color: '#7A4A6B', tint: '#F0E6EC', onInk: '#C08FB3' },
  ],
  dark: [
    { name: 'rose', color: '#E39AA6', tint: '#483538', onInk: '#B25A68' },
    { name: 'ochre', color: '#D9AE5C', tint: '#463B2A', onInk: '#B07E26' },
    { name: 'slate', color: '#8FAECB', tint: '#343B44', onInk: '#4A6A8A' },
    { name: 'moss', color: '#9BBB8F', tint: '#363E33', onInk: '#587554' },
    { name: 'plum', color: '#C08FB3', tint: '#3E2F3A', onInk: '#7A4A6B' },
  ],
};

/**
 * Loaded in the root layout as one family each, so `fontWeight` picks the face:
 * Gloock 400; Hanken Grotesk 400, 500, 600 and 700.
 */
export const Fonts = {
  serif: 'Gloock',
  sans: 'HankenGrotesk',
} as const;

/** 4pt grid. */
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
  /** Cards and the terms box. */
  lg: 14,
  /** The frame around your photo while it's showing. */
  xl: 16,
  /** The top corners of a bottom sheet. */
  sheet: 20,
  pill: 999,
} as const;

/** Every photo is portrait 3:4. */
export const PhotoAspect = 3 / 4;

/** Durations in ms. Motion only ever explains a change. */
export const Motion = {
  press: 120,
  state: 180,
  enter: 250,
  exit: 200,
  burst: 300,
  /** How long the room holds after a pop before the next phase. */
  hold: 1200,
} as const;

/** Worklet easings for timing animations. Never ease-in on UI. */
export const Ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
} as const;

/** The same curves for Reanimated CSS transitions and keyframes. */
export const CssEase = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
} as const;

/** Smallest comfortable touch target, in points. */
export const MinTouch = 44;

export const MaxContentWidth = 560;
