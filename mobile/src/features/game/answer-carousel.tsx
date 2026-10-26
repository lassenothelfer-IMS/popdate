import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Photo, PhotoBadge } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import {
  CssEase,
  Gutter,
  MaxContentWidth,
  Motion,
  PhotoAspect,
  Radius,
  Space,
  type Seat,
} from '@/constants/theme';
import { sentence } from '@/features/game/announce';
import { Quote } from '@/features/game/room-blocks';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';
import { useFilterText } from '@/state/settings';

/** The canvas's card. On shorter screens it narrows, so a whole card stays above the footer. */
const MAX_CARD_WIDTH = 288;
/**
 * A comfortable card. When the canvas's spacing above the cards would leave less
 * than this, the room tightens that spacing to give the card its height back.
 */
export const ROOMY_CARD_WIDTH = 220;
/**
 * Below this the answer has too little width to read; the page scrolls instead.
 * A 375 x 812 iPhone, insets taken off, still fits a whole card above this.
 */
const MIN_CARD_WIDTH = 180;
/** At least this much of the next card peeks in, so the row reads as one to swipe. */
const PEEK = Space.lg;
const CARD_GAP = Space.sm;
const CARD_EDGE = 1;
const CARD_PAD = Space.xs;
/** Room around the cards inside the scroll, so the marked ring is never clipped. */
const RING = 2;
/** A card's padding under its photo: above the name, between it and the answer, and below. */
const TEXT_PADDING = Space.sm + 6 + 6;
/** The name line and two lines of answer, which grow with the text size. */
const TEXT_LINES = 20 + 2 * 26;
/** Where a photo settles from as it develops. Never from nothing. */
const DEVELOP_FROM = 0.97;
const DOT = 10;

const CHROME = 2 * (CARD_EDGE + CARD_PAD);

/**
 * The card width that fits a whole card, answer and marked ring included, into
 * `height`: the canvas's 288 where there is room, never under a readable minimum.
 * `textScale` is the user's text size, which the name and the answer follow.
 */
export function cardWidthFor(height: number, pageWidth: number, textScale = 1) {
  const max = Math.min(MAX_CARD_WIDTH, pageWidth - Gutter - CARD_GAP - PEEK);
  const photoHeight = height - CHROME - TEXT_PADDING - TEXT_LINES * textScale - 2 * RING;
  const fit = Math.floor(photoHeight * PhotoAspect) + CHROME;
  return Math.max(Math.min(fit, max), Math.min(MIN_CARD_WIDTH, max));
}

/** Where a card's photo sits in the carousel, for checking it is in view before it develops. */
export function cardPhotoBox(width: number) {
  return {
    top: RING + CARD_EDGE + CARD_PAD,
    height: (width - CHROME) / PhotoAspect,
  };
}

// Web has no snapToInterval: CSS scroll snapping does the same, one card at a time.
const webTrack =
  Platform.OS === 'web'
    ? ({
        scrollSnapType: 'x mandatory',
        scrollPaddingLeft: Gutter,
      } as unknown as ViewStyle)
    : undefined;
const webCard =
  Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as unknown as ViewStyle) : undefined;

export type AnswerCarouselHandle = {
  /** Brings a card into view, as when its seat is tapped in the room bar. */
  scrollToCard: (contestantId: string) => void;
};

type AnswerCardData = {
  contestant: Contestant;
  seat: Seat;
  /** Its newest photo has come into view and shows. */
  developed: boolean;
};

type AnswerCarouselProps = {
  cards: AnswerCardData[];
  width: number;
  markedId: string | null;
  /** Set only while the popper may mark a balloon. */
  onSelect?: (contestantId: string) => void;
  /** The cards at least half in view, whenever that set changes. */
  onVisibleChange: (contestantIds: string[]) => void;
  ref?: Ref<AnswerCarouselHandle>;
};

/** The popper's reveal: one answer card per balloon still up, side by side, snapping per card. */
export function AnswerCarousel({
  cards,
  width,
  markedId,
  onSelect,
  onVisibleChange,
  ref,
}: AnswerCarouselProps) {
  const reduced = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollX = useRef(0);
  const viewport = useRef(0);
  const reported = useRef<string | null>(null);
  const step = width + CARD_GAP;
  // The track runs edge to edge, so it is as wide as the page.
  const pageWidth = Math.min(windowWidth, MaxContentWidth);
  // As far as the track scrolls: the last card at the right gutter. iOS doesn't
  // clamp an interval snap, so every snap point is clamped here, or swiping to
  // the last card would carry on into empty space and bounce back.
  const maxOffset = Math.max(
    0,
    2 * Gutter + cards.length * width + (cards.length - 1) * CARD_GAP - pageWidth,
  );
  const offsetOf = (index: number) => Math.min(index * step, maxOffset);
  const snapOffsets =
    Platform.OS === 'web' ? undefined : [...new Set(cards.map((_, index) => offsetOf(index)))];

  /** Tells the room which cards are in view. Only calls out when that set changes. */
  function report() {
    // Before the first measure, the page's width, so the room never waits on a layout event.
    const view = viewport.current || pageWidth;
    const ids = cards
      .filter((_, index) => {
        const left = Gutter + index * step - scrollX.current;
        const seen = Math.min(left + width, view) - Math.max(left, 0);
        return seen >= width / 2;
      })
      .map((card) => card.contestant.id);
    const signature = ids.join(',');
    if (signature === reported.current) return;
    reported.current = signature;
    onVisibleChange(ids);
  }

  // Cards come and go, and the width settles once the page is measured.
  useEffect(() => {
    report();
  });

  useImperativeHandle(ref, () => ({
    scrollToCard(contestantId: string) {
      const index = cards.findIndex((card) => card.contestant.id === contestantId);
      if (index < 0) return;
      // Clamped too: iOS would leave an offset past the end where it was put.
      scrollRef.current?.scrollTo({ x: offsetOf(index), animated: !reduced });
    },
  }));

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollX.current = event.nativeEvent.contentOffset.x;
    report();
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // One offset per card, with the end itself as the last. Android also keeps
      // a fling to one card; iOS lets a hard fling travel further, as it does elsewhere.
      snapToOffsets={snapOffsets}
      decelerationRate="fast"
      disableIntervalMomentum
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.width;
        report();
      }}
      style={webTrack}
      contentContainerStyle={styles.track}>
      {cards.map(({ contestant, seat, developed }) => (
        <View key={contestant.id} style={webCard}>
          <AnswerCard
            contestant={contestant}
            seat={seat}
            width={width}
            marked={contestant.id === markedId}
            developed={developed}
            onPress={onSelect ? () => onSelect(contestant.id) : undefined}
          />
        </View>
      ))}
    </ScrollView>
  );
}

type AnswerCardProps = {
  contestant: Contestant;
  seat: Seat;
  width: number;
  marked: boolean;
  developed: boolean;
  onPress?: () => void;
};

/** Their newest photo, then their name and their words. Tapping marks their balloon. */
function AnswerCard({ contestant, seat, width, marked, developed, onPress }: AnswerCardProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const t = useT();
  const filterText = useFilterText();
  const latest = contestant.photos.at(-1);
  const position = contestant.photos.length;
  // Someone else's words: masked when the comment filter is on.
  const answer = contestant.answer ? filterText(contestant.answer) : contestant.answer;
  const name = contestant.name;
  const selectable = !!onPress;
  const photoWidth = width - CHROME;

  // Always the same element, tappable or not, so nothing remounts when the
  // popper's turn to pop starts or ends. Its name ends in "<Name>'s balloon":
  // marking the card marks that balloon.
  return (
    <PressableHighlight
      onPress={onPress}
      disabled={!selectable}
      accessible
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityState={selectable ? { selected: marked } : undefined}
      accessibilityLabel={`${t('common.nameAge', { name, age: contestant.age })}. ${sentence(
        answer ? t('game.answerLabel', { answer }) : t('game.noAnswer'),
      )} ${t('game.balloonOf', { name })}`}
      accessibilityHint={selectable ? t('game.markHint', { name }) : undefined}
      background={theme.field}
      style={[styles.card, { width, borderColor: theme.outline }]}>
      {latest ? (
        // The reveal: the photo develops once it is in view. No stagger, no haptic.
        // Under Reduce Motion only the fade is left.
        <Animated.View
          key={latest}
          style={{
            opacity: developed ? 1 : 0,
            transform: [{ scale: developed || reduced ? 1 : DEVELOP_FROM }],
            transitionProperty: reduced ? 'opacity' : ['opacity', 'transform'],
            transitionDuration: Motion.enter,
            transitionTimingFunction: CssEase.out,
          }}>
          <Photo
            uri={latest}
            name={contestant.name}
            tone={seat}
            style={[styles.photo, { width: photoWidth, height: photoWidth / PhotoAspect }]}
          />
          <PhotoBadge label={t('game.photoN', { n: position })} />
        </Animated.View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.nameLine}>
          <View style={styles.dotBox}>
            <View style={[styles.dot, { backgroundColor: seat.color }]} />
          </View>
          <ThemedText type="row" style={styles.shrink}>
            {contestant.name},{' '}
            <ThemedText type="row" themeColor="textSecondary" style={styles.age}>
              {contestant.age}
            </ThemedText>
          </ThemedText>
        </View>
        <View style={styles.words}>
          {answer ? (
            <Quote text={answer} />
          ) : (
            <ThemedText type="footnote" themeColor="textSecondary">
              {t('game.noAnswer')}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Drawn around the card, so marking it never moves its content. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            borderColor: theme.accentText,
            opacity: marked ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: Motion.state,
            transitionTimingFunction: CssEase.out,
          },
        ]}
      />
    </PressableHighlight>
  );
}

const styles = StyleSheet.create({
  track: {
    alignItems: 'flex-start',
    gap: CARD_GAP,
    paddingHorizontal: Gutter,
    paddingVertical: RING,
  },
  card: {
    padding: CARD_PAD,
    borderWidth: CARD_EDGE,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  photo: {
    borderRadius: Radius.sm,
  },
  body: {
    paddingTop: Space.sm,
    paddingHorizontal: Space.xs,
    paddingBottom: 6,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xxs,
  },
  // The dot's column is 20 wide; pulled in so the dot itself lines up with the text below.
  dotBox: {
    width: 20,
    height: 20,
    marginLeft: -5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  shrink: {
    flexShrink: 1,
  },
  age: {
    fontWeight: 400,
  },
  words: {
    marginTop: 6,
  },
  ring: {
    position: 'absolute',
    top: -RING - CARD_EDGE,
    right: -RING - CARD_EDGE,
    bottom: -RING - CARD_EDGE,
    left: -RING - CARD_EDGE,
    borderRadius: Radius.lg + RING,
    borderCurve: 'continuous',
    borderWidth: RING,
  },
});
