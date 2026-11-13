import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The type scale (design/DESIGN.md section 3). New York for display, SF Pro for
 * text. All sizes follow the user's text size setting; cap the large serif
 * roles with maxFontSizeMultiplier. Nothing under 11 pt; changing numbers are tabular.
 */
export type TextType =
  /** "3rd", "a balloon". New York 300, 112/100. */
  | 'count'
  /** The number under "Round 2 in". New York 300, 56/56, tabular. */
  | 'countdown'
  /** One per screen at most: "Good evening, Lasse.", "Mia chose Ben." New York 500, 44/46. */
  | 'hero'
  /** "Settings", "Matches", "Not this time." New York 500, 40/42. */
  | 'title'
  /** Onboarding titles, "You popped Noah." New York 500, 30/34. */
  | 'display'
  /** A name on Home or a profile. New York 500, 24/28. */
  | 'heading'
  /** The chooser's question in a round. New York 400, 32/38. */
  | 'question'
  /** The question while waiting, or in the final. New York 400, 26/32. */
  | 'questionSmall'
  /** Pick-a-question rows. New York 400, 19/24. */
  | 'questionRow'
  /** An answer on a card. New York italic, 20/26. */
  | 'quote'
  /** A longer answer or bio. New York italic, 18/24. */
  | 'quoteLong'
  /** A sheet's title, "Mia is choosing". SF Pro 600, 17/22. */
  | 'task'
  /** "Round 1 of 4", section titles. SF Pro 600, 15/20. */
  | 'headline'
  /** Paragraphs. SF Pro 400, 17/22. */
  | 'body'
  /** Helper text under titles. SF Pro 400, 15/20. */
  | 'callout'
  /** Chips and text actions. SF Pro 500, 15/20. */
  | 'label'
  /** List rows. SF Pro 500, 17/22. */
  | 'row'
  /** Countdowns in a pill. SF Pro 500, 13, tabular. */
  | 'timer'
  /** Meta: timestamps, hints, "0 of 6". SF Pro 400, 13/18. */
  | 'footnote'
  /** Labels: section headers, "You asked", "Photos". SF Pro 600, 13/18, secondary. */
  | 'kicker'
  /** Names under the balloon row. SF Pro 500, 12/16. */
  | 'railName'
  /** Small meta. SF Pro 400, 12/16. */
  | 'caption'
  /** Tags: "Photo 1", "Round 1", "You". SF Pro 600, 12/16. */
  | 'captionStrong';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

/** Roles that come with their own color unless told otherwise. */
const DEFAULT_COLOR: Partial<Record<TextType, ThemeColor>> = {
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? DEFAULT_COLOR[type] ?? 'text'];
  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

/** A role's type style on its own, for an input that should read like that role. */
export function textStyleOf(type: TextType) {
  return styles[type];
}

const serif = { fontFamily: Fonts.serif } as const;
const sans = { fontFamily: Fonts.sans } as const;

const styles = StyleSheet.create({
  count: {
    ...serif,
    fontWeight: 400,
    fontSize: 112,
    // Room for New York's ascent: at 100 iOS cut off the top of the digits.
    lineHeight: 128,
    letterSpacing: -3.36,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  countdown: {
    ...serif,
    fontWeight: 400,
    fontSize: 56,
    lineHeight: 60,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  // Instrument Serif has one weight and runs narrow, so headings are set large:
  // three to four times the 17 pt body, the size contrast doing the work weight can't.
  hero: { ...serif, fontWeight: 400, fontSize: 62, lineHeight: 64, letterSpacing: -0.6 },
  title: { ...serif, fontWeight: 400, fontSize: 52, lineHeight: 54, letterSpacing: -0.5 },
  display: { ...serif, fontWeight: 400, fontSize: 40, lineHeight: 44, letterSpacing: -0.3 },
  heading: { ...serif, fontWeight: 400, fontSize: 30, lineHeight: 34 },
  question: { ...serif, fontWeight: 400, fontSize: 40, lineHeight: 44 },
  questionSmall: { ...serif, fontWeight: 400, fontSize: 32, lineHeight: 36 },
  questionRow: { ...serif, fontWeight: 400, fontSize: 24, lineHeight: 28 },
  quote: { ...serif, fontStyle: 'italic', fontWeight: 400, fontSize: 24, lineHeight: 30, fontVariant: ['lining-nums'] },
  quoteLong: { ...serif, fontStyle: 'italic', fontWeight: 400, fontSize: 22, lineHeight: 28 },
  task: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 600 },
  headline: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 600 },
  body: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 400 },
  callout: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 400 },
  label: { ...sans, fontSize: 15, lineHeight: 20, fontWeight: 500 },
  row: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 500 },
  timer: { ...sans, fontSize: 13, lineHeight: 18, fontWeight: 500, fontVariant: ['tabular-nums'] },
  footnote: { ...sans, fontSize: 13, lineHeight: 18, fontWeight: 400 },
  // A section's label, like "Your turn": as large as body text, in the text color, set apart by weight.
  kicker: { ...sans, fontSize: 17, lineHeight: 22, fontWeight: 600 },
  railName: { ...sans, fontSize: 12, lineHeight: 16, fontWeight: 500 },
  caption: { ...sans, fontSize: 12, lineHeight: 16, fontWeight: 400 },
  captionStrong: { ...sans, fontSize: 12, lineHeight: 16, fontWeight: 600 },
});
