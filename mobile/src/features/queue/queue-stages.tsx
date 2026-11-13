import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import type { Room } from '@/api';
import {
  Balloon,
  BALLOON_BODY,
  BALLOON_KNOT,
  BALLOON_SHINE,
  balloonInks,
} from '@/components/balloon';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import {
  Bob,
  Pulse,
  RingedAvatar,
  Stage,
  StageBlock,
  stageText,
  stageType,
  YouChip,
} from '@/components/stage';
import { BrandBalloon, Ease, SeatColors } from '@/constants/theme';
import { roomSeatIndex } from '@/features/game/room-seats';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { webSafeKeyframe } from '@/utils/web-motion';

// The queue and the two "room is ready" screens, drawn to design/four-screens on
// the 390 x 844 stage. Positions are the design's own numbers.

const [GOLD, CORAL, BLUSH, GARNET] = SeatColors.map((seat) => seat.color);
const PLUM = BrandBalloon.color;

/** The six seats of the lineup: color, the balloon's center, top and width in the 390 x 200 zone. */
const LINEUP = [
  { color: CORAL, cx: 44, top: 44, width: 54, bob: 'b' },
  { color: BLUSH, cx: 102, top: 12, width: 58, bob: 'c' },
  { color: PLUM, cx: 182, top: 34, width: 92, bob: 'a' },
  { color: GOLD, cx: 262, top: 4, width: 58, bob: 'b' },
  { color: GARNET, cx: 318, top: 40, width: 52, bob: 'c' },
  { color: GOLD, cx: 358, top: 16, width: 44, bob: 'a' },
] as const;
/** Yours is the plum one in the middle; it is always taken, and drawn last so it sits on top. */
const YOURS = 2;
/** The order the seats fill in: you, then left to right around you. */
const FILL_ORDER = [YOURS, 0, 1, 3, 4, 5];

type Spelled = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
function numberWord(t: Translate, value: number) {
  return value >= 0 && value <= 10 ? t(`queue.number${value as Spelled}`) : String(value);
}
function capitalized(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type QueueStageProps = {
  found: number;
  needed: number;
  /** "0:34": how long you have waited. */
  waited: string;
  leaving: boolean;
  /** Once the room is full you are in it: Leave line does nothing. */
  locked: boolean;
  error: string | null;
  onLeave: () => void;
};

/** A balloon drifts up into its seat from below. Yours comes from further: it flew off Play. */
function seatIn(mine: boolean) {
  return webSafeKeyframe(
    new Keyframe({
      0: { opacity: mine ? 1 : 0, transform: [{ translateY: mine ? 520 : 220 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
    }).duration(mine ? 900 : 1000),
  );
}
const yoursIn = seatIn(true);
const othersIn = seatIn(false);

/** The count rolls: the new number comes up from below as the old one leaves upward. */
const numberIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 46 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
  }).duration(420),
);
const numberOut = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 1, transform: [{ translateY: 0 }] },
    100: { opacity: 0, transform: [{ translateY: -46 }] },
  }).duration(260),
);

/** In line: the count, the balloons of the seats taken, and what is still missing. */
export function QueueStage({ found, needed, waited, leaving, locked, error, onLeave }: QueueStageProps) {
  const theme = useTheme();
  const t = useT();
  const reduced = useReduceMotion();
  const taken = Math.max(1, Math.min(found, needed));
  const seats = FILL_ORDER.slice(0, needed);
  const filled = new Set(seats.slice(0, taken));
  // Yours draws last, over its neighbors.
  const drawn = [...seats.filter((slot) => slot !== YOURS), YOURS];
  const missing = needed - taken;
  const caption =
    missing > 0
      ? `${t('queue.moreToGo', { count: missing, people: capitalized(numberWord(t, missing)) })} ${t('queue.buzz')}`
      : t('queue.roomReady');
  const opens = t('queue.opensWhen', { people: numberWord(t, needed) });

  return (
    <Stage>
      <StageBlock index={0} style={styles.queueHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('queue.leaveLine')}
          accessibilityState={{ disabled: locked || leaving, busy: leaving }}
          disabled={locked || leaving}
          onPress={onLeave}
          hitSlop={8}
          style={({ pressed }) => [styles.leave, (pressed || locked) && styles.dim]}>
          {leaving ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Icon name="back" size={17} color={theme.text} />
          )}
          <Text {...stageText} style={[stageType.sans, styles.leaveText, { color: theme.text }]}>
            {t('queue.leaveLine')}
          </Text>
        </Pressable>
        <View style={styles.waited}>
          <Text {...stageText} style={[stageType.sans, styles.waitedText, { color: theme.text }]}>
            {t('queue.waited', { time: waited })}
          </Text>
        </View>
      </StageBlock>
      {error ? (
        <View style={styles.queueError}>
          <ErrorLine message={error} />
        </View>
      ) : null}

      <StageBlock index={1} style={styles.count}>
        <View
          accessible
          accessibilityLabel={`${t('queue.seatsTaken')} ${taken} ${t('queue.ofNeeded', { needed })}. ${opens}`}
          accessibilityLiveRegion="polite"
          style={styles.center}>
          <Text {...stageText} style={[stageType.sans, styles.countLabel, { color: theme.textSecondary }]}>
            {t('queue.seatsTaken')}
          </Text>
          <View style={styles.countRow}>
            {/* Its own slot, as wide as a digit and with room above and below, so a roll cuts nothing off. */}
            <View style={styles.countSlot}>
              <Animated.Text
                key={taken}
                entering={reduced ? undefined : numberIn}
                exiting={reduced ? undefined : numberOut}
                {...stageText}
                style={[stageType.numeral, styles.countNumber, styles.countDigit, { color: theme.text }]}>
                {taken}
              </Animated.Text>
            </View>
            <Text {...stageText} style={[stageType.serif, styles.countOf, { color: theme.textSecondary }]}>
              {t('queue.ofNeeded', { needed })}
            </Text>
          </View>
          <Text {...stageText} style={[stageType.sans, styles.body, styles.countLine, { color: theme.textSecondary }]}>
            {opens}
          </Text>
        </View>
      </StageBlock>

      <StageBlock index={2} style={styles.lineup} pointerEvents="none">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          {drawn.map((slot) => {
            const seat = LINEUP[slot];
            const place = { position: 'absolute', left: seat.cx - seat.width / 2, top: seat.top } as const;
            return filled.has(slot) ? (
              <Animated.View
                key={`${slot}-in`}
                entering={reduced ? undefined : slot === YOURS ? yoursIn : othersIn}
                style={place}>
                <Bob kind={seat.bob}>
                  <Balloon color={seat.color} size={seat.width} />
                </Bob>
              </Animated.View>
            ) : (
              <Pulse key={slot} style={place}>
                <Balloon color={seat.color} size={seat.width} ghost />
              </Pulse>
            );
          })}
          <View style={styles.youChip}>
            <YouChip label={t('common.you')} size="large" />
          </View>
        </View>
      </StageBlock>

      <StageBlock index={3} style={styles.progress}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: needed }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < taken
                  ? { backgroundColor: theme.brand }
                  : { backgroundColor: theme.surface, boxShadow: `inset 0 0 0 1px ${theme.border}` },
              ]}
            />
          ))}
        </View>
        <Text {...stageText} style={[stageType.sans, styles.caption, { color: theme.textSecondary }]}>
          {caption}
        </Text>
      </StageBlock>
    </Stage>
  );
}

type RoomReadyStageProps = {
  room: Room;
  /** How long the countdown runs before the room opens by itself. */
  holdMs: number;
};

/** The room is full: what you are this time, who is in it, and the countdown into round 1. */
export function RoomReadyStage({ room, holdMs }: RoomReadyStageProps) {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const choosing = room.me.role === 'popper';
  const count = room.totalRounds;
  const rounds = numberWord(t, count);
  const total = room.contestants.length + 1;
  const colorOf = (index: number) =>
    seatAt(seats, roomSeatIndex(room.contestants, index, room.me.id)).color;

  return (
    <Stage>
      <StageBlock index={0} style={styles.readyHeader}>
        <Text {...stageText} style={[stageType.sans, styles.readyTitle, { color: theme.text }]}>
          {t('queue.roomReady')}
        </Text>
        <View style={[styles.full, { boxShadow: `inset 0 0 0 1px ${theme.borderStrong}` }]}>
          <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
          <Text {...stageText} style={[stageType.sans, styles.fullText, { color: theme.text }]}>
            {t('queue.seatsFull', { found: total, needed: total })}
          </Text>
        </View>
      </StageBlock>

      {choosing ? (
        <StageBlock index={1} style={styles.bunch} pointerEvents="none">
          <Bunch />
        </StageBlock>
      ) : (
        <StageBlock index={1} style={styles.hero} pointerEvents="none">
          <Bob kind="a">
            <Balloon color={PLUM} size={128} />
          </Bob>
        </StageBlock>
      )}

      <StageBlock index={2} style={[styles.role, { top: choosing ? 366 : 318 }]}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={choosing ? t('queue.popperTitle') : t('queue.contestantTitle')}
          style={styles.center}>
          <Text {...stageText} style={[stageType.serif, styles.lead, { color: theme.textSecondary }]}>
            {choosing ? t('queue.choosingLead') : t('queue.holdingLead')}
          </Text>
          <RoleWord word={choosing ? t('queue.choosingWord') : t('queue.holdingWord')} size={choosing ? 80 : 84} />
        </View>
        <Text
          {...stageText}
          style={[stageType.sans, styles.body, styles.roleLine, { color: theme.textSecondary, width: choosing ? 290 : 270 }]}>
          {choosing
            ? t('queue.popperLine', {
                count,
                rounds,
                people: capitalized(numberWord(t, room.contestants.length)),
              })
            : t('queue.contestantLine', { count, rounds, name: room.popper.name })}
        </Text>
      </StageBlock>

      <StageBlock
        index={3}
        style={[
          styles.card,
          {
            top: choosing ? 578 : 556,
            height: choosing ? 124 : 132,
            backgroundColor: theme.page,
            boxShadow: `inset 0 0 0 1px ${theme.borderStrong}`,
          },
        ]}>
        <View style={styles.chooser} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <RingedAvatar
            initial={room.popper.name.charAt(0).toUpperCase()}
            uri={choosing ? undefined : room.popper.photos[0]}
            dark={choosing}
          />
          {choosing ? (
            <YouChip label={t('common.you')} style={styles.chooserName} />
          ) : (
            <Text {...stageText} numberOfLines={1} style={[stageType.sans, styles.chooserNameText, styles.chooserName, { color: theme.text }]}>
              {room.popper.name}
            </Text>
          )}
          <Text {...stageText} numberOfLines={1} style={[stageType.sans, styles.chooserLabel, { color: theme.brand }]}>
            {choosing ? t('queue.choose') : t('queue.chooses')}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.holders} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {room.contestants.map((contestant, index) => {
            const mine = contestant.id === room.me.id;
            return (
              <View key={contestant.id} style={styles.holder}>
                {mine ? (
                  <Bob kind="b">
                    <Balloon color={colorOf(index)} size={30} />
                  </Bob>
                ) : (
                  <View style={choosing ? null : styles.holderDrop}>
                    <Balloon color={colorOf(index)} size={22} />
                  </View>
                )}
                {mine ? (
                  <YouChip label={t('common.you')} />
                ) : (
                  <Text {...stageText} numberOfLines={1} style={[stageType.sans, styles.holderName, { color: theme.textSecondary }]}>
                    {contestant.name}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </StageBlock>

      <StageBlock index={4} style={styles.countdown}>
        <Countdown label={choosing ? t('queue.pickFirstIn') : t('queue.roundStartsIn')} ms={holdMs} />
      </StageBlock>
    </Stage>
  );
}

/**
 * "a balloon", "choosing": at the design's size, on one line. A longer word in
 * another language shrinks to the line instead of breaking (the web, which can't
 * shrink text to fit, gets a size from the letter count).
 */
function RoleWord({ word, size }: { word: string; size: number }) {
  const theme = useTheme();
  const fontSize = Platform.OS === 'web' ? Math.min(size, Math.floor(350 / (word.length * 0.46))) : size;
  return (
    <Text
      {...stageText}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
      style={[
        stageType.serif,
        styles.word,
        { color: theme.text, fontSize, letterSpacing: -0.015 * fontSize },
      ]}>
      {word}
    </Text>
  );
}

/** The bunch you hold as the chooser: balloon, its turn around the gather point, string length and scale. */
const BUNCH = [
  { color: GOLD, angle: -40, length: 58, scale: 2.5, bend: 1 },
  { color: GARNET, angle: 40, length: 58, scale: 2.5, bend: -1 },
  { color: CORAL, angle: -20, length: 78, scale: 2.8, bend: 1 },
  { color: BLUSH, angle: 20, length: 78, scale: 2.8, bend: -1 },
  { color: PLUM, angle: 0, length: 92, scale: 3.3, bend: 1 },
] as const;
/** Where the strings meet, in the 390 x 270 zone. */
const GATHER = { x: 195, y: 214 };
/** Where a string ties on under the balloon's bow, and the bow's middle, in the balloon's 24 x 34 box. */
const TIE = { x: 12.6, y: 24.3 };
const BOW = { x: 12.7, y: 24 };

/** Five balloons tied in one bow, swaying as one around their foot. */
function Bunch() {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(turn);
      return;
    }
    turn.set(0);
    turn.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, turn]);
  const sway = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reduced ? 0 : -1.2 * Math.cos(turn.get() * 2 * Math.PI)}deg` }],
  }));
  return (
    <Animated.View style={[styles.sway, sway]}>
      <Svg width={390} height={270} viewBox="0 0 390 270">
        {BUNCH.map((balloon) => {
          const { fill, knot } = balloonInks(balloon.color, theme);
          const top = GATHER.y - balloon.length;
          const b = balloon.bend;
          return (
            <G key={`${balloon.color}${balloon.angle}`} transform={`rotate(${balloon.angle} ${GATHER.x} ${GATHER.y})`}>
              <Path
                d={`M${GATHER.x} ${top}c${5 * b} ${balloon.length * 0.35} ${-4 * b} ${balloon.length * 0.7} 0 ${balloon.length}`}
                fill="none"
                stroke={knot}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
              <G transform={`translate(${GATHER.x - TIE.x * balloon.scale} ${top - TIE.y * balloon.scale}) scale(${balloon.scale})`}>
                <Path d={BALLOON_BODY} fill={fill} />
                <Path d={BALLOON_SHINE} fill="#FFFFFF" fillOpacity={0.45} />
                <Path d={BALLOON_KNOT} fill={knot} />
              </G>
            </G>
          );
        })}
        <G transform={`translate(${GATHER.x - BOW.x * 2.6} ${GATHER.y - BOW.y * 2.6}) scale(2.6)`}>
          <Path d={BALLOON_KNOT} fill={theme.text} />
        </G>
        <Path d="M193 218c-7 8 3 14-4 22s2 12-3 18" fill="none" stroke={theme.text} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M197 218c7 7-2 13 4 20s-1 10 2 15" fill="none" stroke={theme.text} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** A countdown, not a button: the track fills left to right and the seconds count down. */
function Countdown({ label, ms }: { label: string; ms: number }) {
  const theme = useTheme();
  const [startedAt] = useState(() => Date.now());
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(1, { duration: ms, easing: Easing.linear }));
    const timer = setInterval(() => {
      setLeft(Math.max(0, Math.ceil((ms - (Date.now() - startedAt)) / 1000)));
    }, 200);
    return () => clearInterval(timer);
  }, [fill, ms, startedAt]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${label} ${left}`}
      style={styles.countdownInner}>
      <View style={[styles.track, { backgroundColor: theme.surface }]}>
        <Animated.View style={[styles.trackFill, { backgroundColor: theme.brand }, grow]} />
      </View>
      <View style={styles.countdownRow}>
        <Text {...stageText} style={[stageType.sans, styles.countdownLabel, { color: theme.textSecondary }]}>
          {label}
        </Text>
        <Text {...stageText} style={[stageType.numeral, styles.countdownSeconds, { color: theme.text }]}>
          {left}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  dim: {
    opacity: 0.4,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Queue
  queueHeader: {
    left: 20,
    right: 20,
    top: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueError: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 100,
  },
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
  },
  leaveText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
  // How long you've waited, as plain figures on the page: no pill behind it.
  waited: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitedText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  count: {
    left: 20,
    right: 20,
    top: 132,
    alignItems: 'center',
  },
  countLabel: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 600,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 2,
  },
  countSlot: {
    width: 84,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDigit: {
    position: 'absolute',
    textAlign: 'center',
    width: 120,
  },
  countNumber: {
    fontSize: 124,
    lineHeight: 124,
    letterSpacing: -2.48,
  },
  countOf: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 400,
  },
  countLine: {
    marginTop: 4,
  },
  lineup: {
    left: 0,
    top: 404,
    width: 390,
    height: 200,
  },
  youChip: {
    position: 'absolute',
    left: 182 - 60,
    width: 120,
    top: 172,
    alignItems: 'center',
  },
  progress: {
    left: 20,
    right: 20,
    top: 652,
    alignItems: 'center',
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  caption: {
    width: 290,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  // Room ready
  readyHeader: {
    left: 24,
    right: 24,
    top: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readyTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: 600,
  },
  full: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fullText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 600,
  },
  hero: {
    left: 0,
    right: 0,
    top: 112,
    alignItems: 'center',
  },
  bunch: {
    left: 0,
    top: 96,
    width: 390,
    height: 270,
  },
  sway: {
    width: 390,
    height: 270,
    transformOrigin: 'bottom',
  },
  role: {
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  lead: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 400,
    textAlign: 'center',
  },
  word: {
    width: 350,
    lineHeight: 88,
    fontWeight: 500,
    textAlign: 'center',
  },
  roleLine: {
    marginTop: 10,
  },
  card: {
    left: 20,
    right: 20,
    borderRadius: 24,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  chooser: {
    width: 66,
    alignItems: 'center',
    gap: 4,
  },
  chooserName: {
    marginTop: 4,
  },
  chooserNameText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 700,
  },
  chooserLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 72,
    marginLeft: 12,
    marginRight: 10,
  },
  holders: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holder: {
    width: 44,
    alignItems: 'center',
    gap: 6,
  },
  holderDrop: {
    marginTop: 11,
  },
  holderName: {
    fontSize: 12,
    lineHeight: 15,
    paddingVertical: 2,
  },
  countdown: {
    left: 20,
    right: 20,
    top: 726,
  },
  countdownInner: {
    alignItems: 'center',
    gap: 12,
  },
  track: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    width: '100%',
    height: '100%',
    transformOrigin: 'left',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  countdownLabel: {
    fontSize: 14,
    lineHeight: 17,
  },
  countdownSeconds: {
    fontSize: 34,
    lineHeight: 34,
  },
});
