import { useEffect, useEffectEvent, useRef } from 'react';
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
import Animated, {
  cancelAnimation,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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
import { webSafeKeyframe } from '@/utils/web-motion';

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
/** A photo that hasn't bloomed yet sits a little back, at 60%. */
const WAITING_OPACITY = 0.6;
/** The bloom from grey to color, once the card is in view. */
const BLOOM_MS = 2400;
/**
 * Grayscale until the photo blooms. React Native draws filter functions other
 * than brightness and opacity on Android and the web only; iOS keeps the dim.
 */
const GREY = Platform.OS === 'ios' ? undefined : ([{ grayscale: 1 }] as ViewStyle['filter']);

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

/**
 * The final two stand side by side, a gap apart, tilted -2 and 2 degrees, the left
 * one a little lower. Each turns about its bottom edge, so the tops fan out into the
 * gutters and the gap between them only widens upward: however tall an answer makes
 * a card, the two never cover each other. The gap also holds the favorite's breath
 * and its ring.
 */
const PAIR_TILT = 2;
const PAIR_GAP = Space.sm;
const PAIR_DROP = 12;
/** Narrower than this, side by side, an answer wraps a word a line: the two stack instead. */
const PAIR_MIN_WIDTH = 150;
const PAIR_STACK_GAP = Space.lg;
/** Above the pair: its padding, kept clear for the ring and the breath. */
const PAIR_PAD = RING + 4;
/**
 * Phones shorter than this (the SE's 667 pt) can't fit the pair's full photos and
 * their answers above the Keep buttons, so there the photos give up height. Taller
 * phones keep the canvas's cards.
 */
export const PAIR_COMPACT_HEIGHT = 740;
/** Under the pair's photos on a short phone: the name line and three lines of answer. */
const PAIR_TEXT_LINES = 22 + 3 * 26;
/** The pair's photo is never cut shorter than this; past it the page scrolls. */
const MIN_PAIR_PHOTO = 48;

/**
 * On a short phone, the width of a card whose photo leaves the name and three
 * lines of answer of both final cards in `height`, the left one's drop included.
 * The pair's photos are cut to that card's photo height.
 */
export function pairCardWidthFor(height: number, textScale = 1) {
  const photoHeight =
    height - PAIR_PAD - PAIR_DROP - CHROME - TEXT_PADDING - PAIR_TEXT_LINES * textScale;
  return Math.floor(Math.max(photoHeight, MIN_PAIR_PHOTO) * PhotoAspect) + CHROME;
}

/** Whether the final two fit side by side on this page. Narrower, they stack and the page scrolls. */
export function pairFitsSideBySide(pageWidth: number) {
  return Math.floor((pageWidth - 2 * Gutter - PAIR_GAP) / 2) >= PAIR_MIN_WIDTH;
}

/**
 * A pair card slides in from 60 pt at its side and settles into its tilt, 150 ms
 * apart. The tilt itself sits on the card inside, so this starts by undoing it and
 * ends at none.
 */
function pairIn(side: -1 | 1) {
  return webSafeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ translateX: 60 * side }, { rotate: `${-PAIR_TILT * side}deg` }] },
      100: {
        opacity: 1,
        transform: [{ translateX: 0 }, { rotate: '0deg' }],
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      },
    })
      .duration(900)
      .delay(side === 1 ? 150 : 0),
  );
}
const leftIn = pairIn(-1);
const rightIn = pairIn(1);

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
  /** The final two: both cards side by side, tilted toward each other, the favorite breathing. */
  pair?: boolean;
};

/** The popper's reveal: one answer card per balloon still up, side by side, snapping per card. */
export function AnswerCarousel({
  cards,
  width,
  markedId,
  onSelect,
  onVisibleChange,
  pair = false,
}: AnswerCarouselProps) {
  const reduced = useReduceMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  // A balloon marked from its card or its seat in the room bar brings its card into
  // view, so you see who you are about to pop. Under Reduce Motion it jumps. An effect
  // event reads the cards, so only a new mark scrolls.
  const showMarked = useEffectEvent((contestantId: string) => {
    const index = cards.findIndex((card) => card.contestant.id === contestantId);
    if (index < 0) return;
    // Clamped too: iOS would leave an offset past the end where it was put.
    scrollRef.current?.scrollTo({ x: offsetOf(index), animated: !reduced });
  });
  useEffect(() => {
    if (markedId) showMarked(markedId);
  }, [markedId]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollX.current = event.nativeEvent.contentOffset.x;
    report();
  }

  if (pair && cards.length === 2) {
    // Both in view at once: no track to swipe. Two equal cards with the gap between
    // them, or, where two would be too narrow to read, one above the other.
    // On a short phone `width` is the photos' height budget, not the cards' width:
    // the cards keep half the page and their photos are cut to that card's photo.
    // Stacked, the two never share one screen anyway, so their photos stay whole.
    const compact = windowHeight < PAIR_COMPACT_HEIGHT && pairFitsSideBySide(pageWidth);
    const sideBySide = Math.min(
      compact ? MAX_CARD_WIDTH : width,
      Math.floor((pageWidth - 2 * Gutter - PAIR_GAP) / 2),
    );
    const stacked = sideBySide < PAIR_MIN_WIDTH;
    const pairWidth = stacked ? width : sideBySide;
    const photoHeight = compact ? (Math.min(pairWidth, width) - CHROME) / PhotoAspect : undefined;
    return (
      <View style={stacked ? styles.pairStacked : styles.pair}>
        {cards.map(({ contestant, seat, developed }, index) => (
          <Animated.View
            key={contestant.id}
            entering={reduced ? undefined : index === 0 ? leftIn : rightIn}
            style={{
              marginTop: index === 0 && !stacked ? PAIR_DROP : 0,
              zIndex: contestant.id === markedId ? 1 : 0,
            }}>
            {/* The tilt lives here, apart from the entrance, so the entrance can't overwrite it. */}
            <View
              style={{
                transform: [{ rotate: `${index === 0 ? -PAIR_TILT : PAIR_TILT}deg` }],
                transformOrigin: 'bottom',
              }}>
              <AnswerCard
                contestant={contestant}
                seat={seat}
                width={pairWidth}
                photoHeight={photoHeight}
                marked={contestant.id === markedId}
                breathe={contestant.id === markedId && !reduced}
                developed={developed}
                onPress={onSelect ? () => onSelect(contestant.id) : undefined}
              />
            </View>
          </Animated.View>
        ))}
      </View>
    );
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
  /** Cut shorter than the photo's 3:4, for the final two on a short phone. */
  photoHeight?: number;
  marked: boolean;
  /** The chooser's favorite in the final two breathes, 1 to 1.04 over 3 s. */
  breathe?: boolean;
  developed: boolean;
  onPress?: () => void;
};

/** Their newest photo, then their name and their words. Tapping marks their balloon. */
function AnswerCard({
  contestant,
  seat,
  width,
  photoHeight,
  marked,
  breathe = false,
  developed,
  onPress,
}: AnswerCardProps) {
  const theme = useTheme();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (!breathe) {
      cancelAnimation(breath);
      breath.set(withTiming(0, { duration: Motion.state }));
      return;
    }
    breath.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [breathe, breath]);
  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * breath.get() }] }));
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
    <Animated.View style={breathing}>
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
      // A large photo card: 22pt corners, a hairline edge, the long soft shadow on Velvet.
      style={[
        styles.card,
        { width, borderColor: theme.borderStrong, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.8)' },
      ]}>
      {latest ? (
        // The reveal: the photo waits in grey and blooms into color over 2.4 s once it
        // is in view. No stagger, no haptic. Under Reduce Motion it is instant.
        <Animated.View
          key={latest}
          style={{
            opacity: developed ? 1 : WAITING_OPACITY,
            filter: developed ? undefined : GREY,
            transform: [{ scale: developed || reduced ? 1 : DEVELOP_FROM }],
            transitionProperty: reduced ? [] : ['opacity', 'transform'],
            transitionDuration: BLOOM_MS,
            transitionTimingFunction: CssEase.out,
          }}>
          <Photo
            uri={latest}
            name={contestant.name}
            tone={seat}
            style={[
              styles.photo,
              {
                width: photoWidth,
                height: Math.min(photoWidth / PhotoAspect, photoHeight ?? Infinity),
              },
            ]}
          />
          <PhotoBadge label={t('game.photoN', { n: position })} />
        </Animated.View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.nameLine}>
          <View style={styles.dotBox}>
            <View style={[styles.dot, { backgroundColor: seat.color }]} />
          </View>
          <ThemedText type="row" style={[styles.shrink, styles.name]}>
            {contestant.name}, {contestant.age}
          </ThemedText>
        </View>
        <View style={styles.words}>
          {answer ? (
            <Quote text={answer} />
          ) : (
            <ThemedText type="callout" themeColor="textSecondary">
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
            // The chooser's favorite: a 2 pt coral ring.
            borderColor: theme.accent,
            opacity: marked ? 1 : 0,
            transitionProperty: 'opacity',
            transitionDuration: Motion.state,
            transitionTimingFunction: CssEase.out,
          },
        ]}
      />
    </PressableHighlight>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: PAIR_GAP,
    paddingHorizontal: Gutter,
    paddingVertical: RING + 4,
  },
  pairStacked: {
    alignItems: 'center',
    gap: PAIR_STACK_GAP,
    paddingHorizontal: Gutter,
    paddingVertical: RING + 4,
  },
  track: {
    alignItems: 'flex-start',
    gap: CARD_GAP,
    paddingHorizontal: Gutter,
    paddingVertical: RING,
  },
  card: {
    padding: CARD_PAD,
    borderWidth: CARD_EDGE,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  photo: {
    borderRadius: Radius.card - CARD_PAD - CARD_EDGE,
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
  name: {
    fontSize: 16,
    fontWeight: 600,
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
    borderRadius: Radius.card + RING,
    borderCurve: 'continuous',
    borderWidth: RING,
  },
});
