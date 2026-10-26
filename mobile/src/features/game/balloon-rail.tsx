import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion } from '@/constants/theme';
import { SeatMark, type SeatState } from '@/features/game/seat-mark';
import { YouTag } from '@/features/game/you-tag';
import { useTextScale } from '@/hooks/use-text-scale';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';

/**
 * Above this text size the names and the You pill don't fit under five
 * balloons; VoiceOver still reads them, and your seat gets an ink dot instead.
 */
const NAMES_UP_TO_SCALE = 1.35;
const DOT_SIZE = 6;
/** A seat whose answer card is out of view while the popper browses the cards. */
const DIMMED = 0.4;

type BalloonRailProps = {
  contestants: Contestant[];
  meId: string;
  /** The balloon the popper has marked, if any. */
  markedId: string | null;
  /** Drawn as popped already, while the pop is on its way to the server. */
  poppingId?: string | null;
  /** The last balloon, which rises once the game is over. */
  risenId?: string | null;
  /** Seats whose answer card is out of view. Null while no cards are showing. */
  inView?: readonly string[] | null;
  /** Set only while you are the popper and may pop. */
  onSelect?: (contestantId: string) => void;
};

/** The five seats in seat order, under the round, over a hairline. */
export function BalloonRail({
  contestants,
  meId,
  markedId,
  poppingId = null,
  risenId = null,
  inView = null,
  onSelect,
}: BalloonRailProps) {
  const seats = useSeats();
  const showNames = useTextScale() <= NAMES_UP_TO_SCALE;
  return (
    <View style={styles.rail}>
      {contestants.map((contestant, index) => {
        const popped = contestant.popped || contestant.id === poppingId;
        const marked = !popped && contestant.id === markedId;
        return (
          <Seat
            key={contestant.id}
            contestant={contestant}
            color={seatAt(seats, index).color}
            state={popped ? 'pop' : marked ? 'mark' : 'up'}
            dimmed={!popped && !marked && !!inView && !inView.includes(contestant.id)}
            isMe={contestant.id === meId}
            risen={contestant.id === risenId}
            showName={showNames}
            onSelect={onSelect && !popped ? () => onSelect(contestant.id) : undefined}
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
) {
  const owner = isMe ? t('common.you') : contestant.name;
  if (risen) return t('game.seatLast', { owner });
  if (state === 'mark') return t('game.seatMarked', { owner });
  if (state === 'up') return owner;
  const round = contestant.poppedInRound;
  if (contestant.left) {
    return round ? t('game.seatLeftInRound', { owner, round }) : t('game.seatLeft', { owner });
  }
  return round ? t('game.seatPoppedInRound', { owner, round }) : t('game.seatPopped', { owner });
}

type SeatProps = {
  contestant: Contestant;
  color: string;
  state: SeatState;
  dimmed: boolean;
  isMe: boolean;
  risen: boolean;
  showName: boolean;
  onSelect?: () => void;
};

function Seat({ contestant, color, state, dimmed, isMe, risen, showName, onSelect }: SeatProps) {
  const theme = useTheme();
  const t = useT();
  const selectable = !!onSelect;

  // Always the same element, tappable or not, so VoiceOver keeps its place when
  // the popper's turn starts or ends. A seat that can't be marked takes no touches.
  // A tappable seat is named by the person alone: the answer cards are the
  // buttons named "<Name>'s balloon".
  return (
    <PressableScale
      accessible
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityLabel={seatLabel(t, contestant, isMe, state, risen)}
      accessibilityHint={selectable ? t('game.markHint', { name: contestant.name }) : undefined}
      accessibilityState={selectable ? { selected: state === 'mark' } : undefined}
      onPress={onSelect}
      containerStyle={[styles.pressable, !selectable && styles.inert]}
      style={styles.seat}>
      <Animated.View
        style={[
          styles.seatBody,
          {
            opacity: dimmed ? DIMMED : 1,
            transitionProperty: 'opacity',
            transitionDuration: Motion.state,
            transitionTimingFunction: CssEase.out,
          },
        ]}>
        <SeatMark color={color} state={state} risen={risen} />
        {isMe ? (
          showName ? (
            <YouTag />
          ) : (
            <View style={[styles.dot, { backgroundColor: theme.inverse }]} />
          )
        ) : showName ? (
          <ThemedText
            type="railName"
            themeColor={state === 'pop' ? 'textTertiary' : 'textSecondary'}
            numberOfLines={1}
            style={styles.name}>
            {contestant.name}
          </ThemedText>
        ) : null}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
  },
  pressable: {
    flex: 1,
    minWidth: 0,
  },
  inert: {
    pointerEvents: 'none',
  },
  seat: {
    alignItems: 'center',
  },
  seatBody: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    textAlign: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
