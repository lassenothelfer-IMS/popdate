import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The type scale. Gloock for people's words and the few big lines, Hanken
 * Grotesk for everything you read to act or tap. All sizes follow the user's
 * text size setting; cap the large serif roles with maxFontSizeMultiplier.
 */
export type TextType =
  /** One per screen at most: the welcome line, the match, the room result. 40/42. */
  | 'hero'
  /** The queue count. 64. */
  | 'count'
  /** Screen titles and the pop line. 30/34. */
  | 'display'
  /** A name on Home. 24/28. */
  | 'heading'
  /** The round's question, the role line. 22/28. */
  | 'question'
  /** An answer. 20/26. */
  | 'quote'
  /** A longer answer or bio. 17/24. */
  | 'quoteLong'
  /** "Mia is choosing", a sheet's title. 17/22 SemiBold. */
  | 'task'
  /** Section titles, the round, "Choose whose balloon to pop". 15/20 SemiBold. */
  | 'headline'
  /** 17/22. */
  | 'body'
  /** Status lines and asides. 15/20. */
  | 'callout'
  /** Chips and text actions. 15/20 Medium. */
  | 'label'
  /** Names in the room's lists and option rows. 16/20 Medium. */
  | 'row'
  /** Countdowns. 13 Medium, tabular. */
  | 'timer'
  /** Meta, helper text, field labels. 13/18. */
  | 'footnote'
  /** "You asked", "Mia asks". 13/18 SemiBold in pop red's text shade. */
  | 'kicker'
  /** Names under the balloon strip. 12/20 Medium. */
  | 'railName'
  /** Quiet pills such as Watching and Photo 1. 12/16 Medium. */
  | 'caption'
  /** The You tag. 12/16 SemiBold. */
  | 'captionStrong';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

/** Roles that come with their own color unless told otherwise. */
const DEFAULT_COLOR: Partial<Record<TextType, ThemeColor>> = {
  kicker: 'accentText',
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? DEFAULT_COLOR[type] ?? 'text'];
  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const serif = { fontFamily: Fonts.serif, fontWeight: 400 } as const;
const sans = { fontFamily: Fonts.sans } as const;

const styles = StyleSheet.create({
  hero: { ...serif, fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
  count: {
    ...serif,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1.9,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  display: { ...serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.45 },
  heading: { ...serif, fontSize: 24, lineHeight: 28 },
  question: { ...serif, fontSize: 22, lineHeight: 28 },
  quote: { ...serif, fontSize: 20, lineHeight: 26, fontVariant: ['lining-nums'] },
  quoteLong: { ...serif, fontSize: 17, lineHeight: 24 },
  task: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 600 },
  headline: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 600 },
  body: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 400 },
  callout: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 400 },
  label: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 500 },
  row: { ...sans, fontSize: 16, lineHeight: 20, fontWeight: 500 },
  timer: { ...sans, fontSize: 13, lineHeight: 18, fontWeight: 500, fontVariant: ['tabular-nums'] },
  footnote: { ...sans, fontSize: 13, lineHeight: 18, fontWeight: 400 },
  kicker: { ...sans, fontSize: 13, lineHeight: 18, fontWeight: 600 },
  railName: { ...sans, fontSize: 12, lineHeight: 20, fontWeight: 500 },
  caption: { ...sans, fontSize: 12, lineHeight: 16, fontWeight: 500 },
  captionStrong: { ...sans, fontSize: 12, lineHeight: 16, fontWeight: 600 },
});
