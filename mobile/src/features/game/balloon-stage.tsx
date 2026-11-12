import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Contestant } from '@/api';
import { Avatar } from '@/components/avatar';
import { Balloon, balloonHeight } from '@/components/balloon';
import { Bob } from '@/components/stage';
import { ThemedText } from '@/components/themed-text';
import { CssEase, lacquerFor, Motion } from '@/constants/theme';
import { roomSeatIndex } from '@/features/game/room-seats';
import { YouTag } from '@/features/game/you-tag';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTextScale } from '@/hooks/use-text-scale';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** Above this text size the names don't fit under five balloons; VoiceOver still reads them. */
const NAMES_UP_TO_SCALE = 1.35;
/** How long the chooser holds a balloon before it pops, the same as the Pop button. */
const HOLD_MS = 1000;
const DRAIN_MS = 260;
/** A seat that isn't the one in focus: out of view in the cards, or not its turn in the reveal. */
const DIMMED = 0.32;
/** How far down each seat hangs, so the five float at their own heights instead of standing in a row. */
const DROP = [20, 0, 28, 6, 22, 10];
/** Each seat floats to its own rhythm. */
const BOBS = ['a', 'b', 'c', 'b', 'a', 'c'] as const;
/** Below this window height (an iPhone SE) the stage is smaller and nearly level. */
const COMPACT_BELOW = 720;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type SeatState = 'up' | 'mark' | 'pop';

type BalloonStageProps = {
  contestants: Contestant[];
  meId: string;
  /** The balloon the chooser has marked, if any. */
  markedId: string | null;
  /** Drawn as popped already, while the pop is on its way to the server. */
  poppingId?: string | null;
  /** The last balloon, which rises once the game is over. */
  risenId?: string | null;
  /** Seats whose answer card is in view while the chooser browses the cards. Null while none show. */
  inView?: readonly string[] | null;
  /** Whose turn it is in the reveal: they step forward and the rest stand back. */
  spotlightId?: string | null;
  /** Answers are being written: a tick lands on whoever has sent theirs. */
  answering?: boolean;
  /** People whose newest photo the reveal hasn't shown yet: their face keeps the one before. */
  unrevealed?: ReadonlySet<string>;
  /** Set only while you are the chooser and may pop: a tap marks a balloon. */
  onSelect?: (contestantId: string) => void;
  /** Set with `onSelect` once the reveal is over: holding a balloon pops it. */
  onPop?: (contestantId: string) => void;
};

/**
 * The room's stage: every balloon floating at its own height, each carrying its
 * person, in seat order. It shows at a glance who is still up, who has answered,
 * whose turn it is in the reveal, and who is gone. The chooser taps a balloon to
 * mark it and holds it to pop it.
 */
export function BalloonStage({
  contestants,
  meId,
  markedId,
  poppingId = null,
  risenId = null,
  inView = null,
  spotlightId = null,
  answering = false,
  unrevealed,
  onSelect,
  onPop,
}: BalloonStageProps) {
  const seats = useSeats();
  const showNames = useTextScale() <= NAMES_UP_TO_SCALE;
  const compact = useWindowDimensions().height < COMPACT_BELOW;
  return (
    <View style={styles.stage}>
      {contestants.map((contestant, index) => {
        const popped = contestant.popped || contestant.id === poppingId;
        const marked = !popped && contestant.id === markedId;
        const state: SeatState = popped ? 'pop' : marked ? 'mark' : 'up';
        const away =
          !popped &&
          !marked &&
          ((spotlightId !== null && spotlightId !== contestant.id) ||
            (!!inView && !inView.includes(contestant.id)));
        return (
          <Seat
            key={contestant.id}
            contestant={contestant}
            photo={contestant.photos.at(unrevealed?.has(contestant.id) ? -2 : -1)}
            color={seatAt(seats, roomSeatIndex(contestants, index, meId)).color}
            state={state}
            dimmed={away}
            forward={!popped && spotlightId === contestant.id}
            ticked={answering && !popped && contestant.answered}
            isMe={contestant.id === meId}
            risen={contestant.id === risenId}
            showName={showNames}
            compact={compact}
            drop={(compact ? 0.35 : 1) * DROP[index % DROP.length]}
            bob={BOBS[index % BOBS.length]}
            onSelect={onSelect && !popped ? () => onSelect(contestant.id) : undefined}
            onPop={onPop && !popped ? () => onPop(contestant.id) : undefined}
          />
        );
      })}
    </View>
  );
}

function seatLabel(
  t: Translate,
  contestant: Contestant,
  isMe: boolean,
  state: SeatState,
  risen: boolean,
  ticked: boolean,
) {
  const owner = isMe ? t('common.you') : contestant.name;
  if (risen) return t('game.seatLast', { owner });
  if (state === 'mark') return t('game.seatMarked', { owner });
  if (state === 'up') return ticked ? `${owner}, ${t('game.answered')}` : owner;
  const round = contestant.poppedInRound;
  if (contestant.left) {
    return round ? t('game.seatLeftInRound', { owner, round }) : t('game.seatLeft', { owner });
  }
  return round ? t('game.seatPoppedInRound', { owner, round }) : t('game.seatPopped', { owner });
}

type SeatProps = {
  contestant: Contestant;
  /** The photo on their face: the newest one the room has seen. */
  photo: string | undefined;
  color: string;
  state: SeatState;
  dimmed: boolean;
  forward: boolean;
  ticked: boolean;
  isMe: boolean;
  risen: boolean;
  showName: boolean;
  compact: boolean;
  drop: number;
  bob: (typeof BOBS)[number];
  onSelect?: () => void;
  onPop?: () => void;
};

function Seat({
  contestant,
  photo,
  color,
  state,
  dimmed,
  forward,
  ticked,
  isMe,
  risen,
  showName,
  compact,
  drop,
  bob,
  onSelect,
  onPop,
}: SeatProps) {
  const theme = useTheme();
  const t = useT();
  const reduced = useReduceMotion();
  const selectable = !!onSelect;
  const popped = state === 'pop';
  const balloon = compact ? 30 : 38;
  const face = compact ? 34 : 40;
  const ring = balloon + 22;
  const seat = lacquerFor(color);

  /** 0 at rest, 1 when the hold is full and the balloon pops. */
  const hold = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function pressIn() {
    if (!onPop) return;
    held.current = false;
    haptics.selection();
    cancelAnimation(hold);
    hold.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      held.current = true;
      onPop();
    }, HOLD_MS);
  }
  function pressOut() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(hold);
    hold.set(withTiming(0, { duration: DRAIN_MS }));
  }

  const swell = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (reduced ? 0 : 0.26) * hold.get() }] }));
  const around = 2 * Math.PI * (ring / 2 - 2);
  const closing = useAnimatedProps(() => ({ strokeDashoffset: around * (1 - hold.get()) }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: hold.get() > 0 ? 1 : 0 }));

  // Always the same element, pressable or not, so VoiceOver keeps its place when the
  // chooser's turn starts or ends. A seat that can't be marked takes no touches.
  return (
    <Pressable
      accessible
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityLabel={seatLabel(t, contestant, isMe, state, risen, ticked)}
      accessibilityHint={selectable ? t('game.markHint', { name: contestant.name }) : undefined}
      accessibilityState={selectable ? { selected: state === 'mark' } : undefined}
      // VoiceOver can't hold: its "pop" action does it.
      accessibilityActions={onPop ? [{ name: 'activate' }, { name: 'pop', label: t('game.popBalloon', { name: contestant.name }) }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'pop') onPop?.();
        else onSelect?.();
      }}
      onPress={() => {
        // A hold that popped is not also a tap.
        if (!held.current) onSelect?.();
      }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.pressable, !selectable && styles.inert, { paddingTop: drop }]}>
      <Animated.View
        style={[
          styles.seat,
          {
            opacity: popped ? 0.42 : dimmed ? DIMMED : 1,
            transform: [
              { translateY: popped ? 8 : risen ? -8 : 0 },
              { scale: forward ? 1.16 : state === 'mark' ? 1.08 : popped ? 0.9 : 1 },
            ],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: reduced ? 0 : Motion.enter,
            transitionTimingFunction: CssEase.out,
          },
        ]}>
        <View style={{ width: ring, height: balloonHeight(balloon) - 8, alignItems: 'center' }}>
          {/* The hold closes a ring around the balloon while it swells. */}
          <Animated.View style={[styles.ring, { width: ring, height: ring }, ringStyle]} pointerEvents="none">
            <Svg width={ring} height={ring} style={styles.turned}>
              <AnimatedCircle
                cx={ring / 2}
                cy={ring / 2}
                r={ring / 2 - 2}
                fill="none"
                stroke={theme.text}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={around}
                animatedProps={closing}
              />
            </Svg>
          </Animated.View>
          <Animated.View style={swell}>
            {popped ? (
              <Balloon color={color} size={balloon} popped />
            ) : (
              <Bob kind={bob}>
                <Balloon color={color} size={balloon} />
              </Bob>
            )}
          </Animated.View>
        </View>
        <View>
          <View
            style={[
              styles.face,
              {
                width: face + 6,
                height: face + 6,
                borderRadius: (face + 6) / 2,
                borderColor: state === 'mark' ? theme.text : color,
                backgroundColor: theme.page,
              },
            ]}>
            <Avatar name={contestant.name} uri={photo} tone={seat} size={face} />
          </View>
          {ticked ? (
            <View style={[styles.tick, { backgroundColor: theme.success, borderColor: theme.page }]}>
              <Svg width={10} height={10} viewBox="0 0 10 10">
                <Path
                  d="M2 5.2l2 2 4-4.4"
                  stroke={theme.onInverse}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
          ) : null}
        </View>
        {isMe && showName ? (
          <YouTag />
        ) : showName ? (
          <ThemedText type="railName" numberOfLines={1} style={styles.name}>
            {contestant.name}
          </ThemedText>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pressable: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  inert: {
    pointerEvents: 'none',
  },
  seat: {
    alignItems: 'center',
    gap: 4,
  },
  ring: {
    position: 'absolute',
    top: -8,
  },
  // The ring closes clockwise from the top.
  turned: {
    transform: [{ rotate: '-90deg' }],
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tick: {
    position: 'absolute',
    right: -3,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    textAlign: 'center',
    marginTop: 1,
  },
});
