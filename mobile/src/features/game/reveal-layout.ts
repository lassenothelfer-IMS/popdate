import { StyleSheet } from 'react-native';

import { Space } from '@/constants/theme';
import {
  cardWidthFor,
  PAIR_COMPACT_HEIGHT,
  pairCardWidthFor,
  pairFitsSideBySide,
  ROOMY_CARD_WIDTH,
} from '@/features/game/answer-carousel';

/** The Pop button's bar: its top padding, the button and the hairline, before the bottom inset. */
const POP_BAR = Space.sm + 56 + StyleSheet.hairlineWidth;
/**
 * In the final two, "Laura's balloon pops." under the button: its gap, then one
 * footnote line, which grows with the text size.
 */
const KEEPER_GAP = Space.xs;
const KEEPER_LINE = 18;
/** In your first rooms, "Hold to pop" over the Pop button: the footer's gap, then one footnote line. */
const HOLD_HINT_LINE = 18;
/**
 * The final two's bar: its top padding, the Keep buttons and the hairline. In your
 * first rooms the hint above them, two callout lines on a phone, and its gap.
 */
const KEEP_BAR = Space.sm + 52 + StyleSheet.hairlineWidth;
const KEEP_HINT_LINES = 2 * 20;
/**
 * Until they are measured, at the default text size: the room bar, and the
 * question block (kicker and two lines of question).
 */
export const BAR_ESTIMATE = 160;
export const QUESTION_ESTIMATE = 18 + 6 + 2 * 28;
/** "Choose whose balloon to pop": one headline line at the default text size. */
const CHOOSE_LINE = 20;
/**
 * The space around the popper's question and the answer cards under it: above the
 * question, above "Choose whose balloon to pop", above the cards, and kept clear
 * between the cards and the Pop bar. The canvas's spacing where a comfortable card
 * still fits under it. Where it doesn't (a 375 x 812 iPhone once its insets are
 * taken off), the tighter set gives the card that height back, so the whole card,
 * answer included, stays above the Pop bar. Smaller phones scroll instead.
 */
export type RevealSpacing = { question: number; choose: number; cards: number; below: number };
export const CANVAS_SPACING: RevealSpacing = {
  question: 20,
  choose: 14,
  cards: Space.sm - 2,
  below: Space.sm,
};
export const TIGHT_SPACING: RevealSpacing = {
  question: Space.sm,
  choose: Space.xs,
  cards: Space.xs - 2,
  below: Space.xs,
};

type RevealLayoutInput = {
  isPopper: boolean;
  window: { width: number; height: number };
  insets: { top: number; bottom: number };
  /** The room bar's measured height, or 0 before it is measured. */
  barHeight: number;
  /** The question block's measured height this round, if it has been. */
  questionHeight: number | null;
  /** Where the answer cards start on the page this round, if measured. */
  cardsTop: number | null;
  /** Balloons still up. */
  upCount: number;
  showHints: boolean;
  textScale: number;
  pageWidth: number;
};

/**
 * The answer cards are as wide as the canvas's where the screen has room, and
 * narrower where it doesn't, so a whole card sits above the Pop button. The room
 * is measured as if that button showed, with the line under it in the final two,
 * so marking a card never resizes them.
 */
export function revealLayout(input: RevealLayoutInput) {
  const { window, insets, textScale, pageWidth } = input;
  const revealRoom =
    window.height -
    insets.top -
    (input.barHeight || BAR_ESTIMATE) -
    POP_BAR -
    (input.upCount === 2 ? KEEPER_GAP + KEEPER_LINE * textScale : 0) -
    (input.showHints && input.upCount > 2 ? Space.sm + HOLD_HINT_LINE * textScale : 0) -
    Math.max(insets.bottom, Space.md);
  const questionHeight = input.questionHeight ?? QUESTION_ESTIMATE;
  const headerHeight = (spacing: RevealSpacing) =>
    spacing.question + questionHeight + spacing.choose + CHOOSE_LINE * textScale + spacing.cards;
  // Tightened when a comfortable card wouldn't fit under the canvas's spacing. Decided
  // from the question's height, which the spacing doesn't change, so it never flips
  // back and forth; and from the moment the question is asked, so the question
  // doesn't jump when the cards arrive.
  const tight =
    input.isPopper &&
    cardWidthFor(
      revealRoom - headerHeight(CANVAS_SPACING) - CANVAS_SPACING.below,
      pageWidth,
      textScale,
    ) < ROOMY_CARD_WIDTH;
  const spacing = tight ? TIGHT_SPACING : CANVAS_SPACING;
  // The cards fade in after the question, so a measure that corrects this lands before they show.
  const cardsAt = input.cardsTop ?? headerHeight(spacing);
  let cardWidth = cardWidthFor(revealRoom - cardsAt - spacing.below, pageWidth, textScale);
  // The final two on a short phone: the width whose photo leaves both names and three
  // lines of each answer above the Keep buttons. The cards cut their photos to it.
  if (input.upCount === 2 && window.height < PAIR_COMPACT_HEIGHT && pairFitsSideBySide(pageWidth)) {
    const keepRoom =
      window.height -
      insets.top -
      (input.barHeight || BAR_ESTIMATE) -
      KEEP_BAR -
      (input.showHints ? Space.sm + KEEP_HINT_LINES * textScale : 0) -
      Math.max(insets.bottom, Space.md);
    cardWidth = Math.min(
      cardWidth,
      pairCardWidthFor(keepRoom - cardsAt - spacing.below, textScale),
    );
  }
  return { tight, cardsAt, cardWidth };
}
