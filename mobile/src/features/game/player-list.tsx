import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Space, type Seat } from '@/constants/theme';
import { LiveRow, PoppedRow } from '@/features/game/player-row';
import { cardTransition, listOut } from '@/features/game/room-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type PlayerListProps = {
  /** Still in, in seat order. */
  stillIn: Contestant[];
  /** Popped, a pop on its way first. */
  popped: Contestant[];
  seatOf: (contestant: Contestant) => Seat;
  meId: string;
  round: number;
  pendingId: string | null;
  /** While answering, for everyone: a count on top, and each row says whether they answered. */
  showAnswered: boolean;
  style: StyleProp<ViewStyle>;
};

/**
 * Who is still in, then who has popped. One keyed list, so a popped row slides
 * down to the popped ones and the others slide up into its place instead of jumping.
 */
export function PlayerList({
  stillIn,
  popped,
  seatOf,
  meId,
  round,
  pendingId,
  showAnswered,
  style,
}: PlayerListProps) {
  const t = useT();
  const theme = useTheme();
  const rows: ReactNode[] = [];
  // While answers come in, everyone sees how far the room is, not only the chooser.
  if (showAnswered && stillIn.length > 0) {
    rows.push(
      <Animated.View key="answered-header" layout={cardTransition} style={styles.answeredHeader}>
        <ThemedText type="callout" themeColor="textSecondary" accessibilityRole="header">
          {t('game.answeredCount', {
            count: stillIn.filter((contestant) => contestant.answered).length,
            total: stillIn.length,
          })}
        </ThemedText>
      </Animated.View>,
    );
  }
  rows.push(
    ...stillIn.map((contestant) => (
      <Animated.View key={contestant.id} layout={cardTransition}>
        <LiveRow
          contestant={contestant}
          color={seatOf(contestant).color}
          isMe={contestant.id === meId}
          status={showAnswered ? (contestant.answered ? 'answered' : 'writing') : undefined}
        />
      </Animated.View>
    )),
  );
  if (popped.length > 0) {
    rows.push(
      <Animated.View key="popped-header" layout={cardTransition} style={styles.poppedHeader}>
        <ThemedText type="callout" themeColor="textSecondary" accessibilityRole="header">
          {t('game.popped')}
        </ThemedText>
      </Animated.View>,
    );
  }
  rows.push(
    ...popped.map((contestant, index) => (
      <Animated.View key={contestant.id} layout={cardTransition}>
        <PoppedRow
          contestant={contestant}
          color={seatOf(contestant).color}
          isMe={contestant.id === meId}
          round={contestant.poppedInRound ?? (contestant.id === pendingId ? round : null)}
          last={index === popped.length - 1}
        />
      </Animated.View>
    )),
  );
  return (
    <Animated.View
      exiting={listOut}
      style={[style, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      {rows}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** The count sits just under the list's top hairline. */
  answeredHeader: {
    marginTop: Space.sm,
  },
  /** A new group: more space above the heading than below it. */
  poppedHeader: {
    marginTop: Space.md,
  },
});
