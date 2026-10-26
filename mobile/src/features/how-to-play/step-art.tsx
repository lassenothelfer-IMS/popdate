import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Balloon, PoppedMark } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { Photo } from '@/components/photo';
import { ProgressSegments } from '@/components/progress-segments';
import { ThemedText } from '@/components/themed-text';
import { PhotoAspect, Radius, Space } from '@/constants/theme';
import { seatAt, useScheme, useSeats, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Small pictures for How to play, drawn with the room's own pieces: the popper's
 * circle, the five seat balloons, photo tiles, round segments and the popped mark.
 * All decorative: the step's sentence carries the meaning.
 */

const SEATS = [0, 1, 2, 3, 4] as const;

/** One person chooses, five hold balloons: the popper's circle, a hairline, five balloons. */
export function OneAndFiveArt() {
  const theme = useTheme();
  const scheme = useScheme();
  const seats = useSeats();
  // The canvas's own neutral tile: surface by day, one step up by night.
  const tile = scheme === 'dark' ? theme.surfacePressed : theme.surface;
  return (
    <View style={styles.row}>
      <Avatar name="Mia" tone={{ color: theme.text, tint: tile }} size={40} />
      <View style={[styles.divider, { backgroundColor: theme.borderStrong }]} />
      <View style={styles.balloons}>
        {SEATS.map((i) => (
          <Balloon key={i} color={seatAt(seats, i).color} size={22} />
        ))}
      </View>
    </View>
  );
}

/** Everyone answers the same question: one question over five small balloons. */
export function SameQuestionArt() {
  const seats = useSeats();
  const t = useT();
  return (
    <View style={styles.column}>
      <ThemedText type="quote" style={styles.question} maxFontSizeMultiplier={1.3}>
        {t('howToPlay.sampleQuestion')}
      </ThemedText>
      <View style={styles.smallBalloons}>
        {SEATS.map((i) => (
          <Balloon key={i} color={seatAt(seats, i).color} size={14} />
        ))}
      </View>
    </View>
  );
}

const TILE_WIDTH = 40;
const ROUNDS = 4;
const ROUND = 2;

/** Each round one more photo appears and one balloon pops: round 2 of 4, two photos, one pop. */
export function RoundArt() {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const sara = seatAt(seats, 2);
  return (
    <View style={styles.column}>
      <View style={styles.segments}>
        <ProgressSegments
          total={ROUNDS}
          filled={ROUND}
          accessibilityLabel={t('howToPlay.roundOf', { round: ROUND, total: ROUNDS })}
        />
      </View>
      <View style={styles.tiles}>
        {Array.from({ length: ROUNDS }, (_, i) =>
          i < ROUND ? (
            <Photo
              key={i}
              uri="mock://how-to-play"
              name="Sara"
              tone={sara}
              initialSize={20}
              style={[styles.tile, { borderRadius: Radius.xs }]}
            />
          ) : (
            <View
              key={i}
              style={[
                styles.tile,
                styles.hidden,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Icon name="lock" size={12} color={theme.textTertiary} />
            </View>
          ),
        )}
      </View>
      <View style={styles.smallBalloons}>
        {SEATS.map((i) =>
          i === 0 ? (
            <PoppedMark key={i} color={seatAt(seats, i).color} size={16} />
          ) : (
            <Balloon key={i} color={seatAt(seats, i).color} size={16} />
          ),
        )}
      </View>
    </View>
  );
}

/** The last balloon is the match: four popped marks and one balloon, a little higher. */
export function LastBalloonArt() {
  const seats = useSeats();
  return (
    <View style={styles.finale}>
      {SEATS.map((i) =>
        i === 4 ? (
          <View key={i} style={styles.risen}>
            <Balloon color={seatAt(seats, i).color} size={34} />
          </View>
        ) : (
          <PoppedMark key={i} color={seatAt(seats, i).color} size={20} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  balloons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  column: {
    alignItems: 'center',
    gap: Space.sm,
  },
  question: {
    textAlign: 'center',
    maxWidth: 260,
  },
  smallBalloons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.xs,
  },
  segments: {
    width: 136,
  },
  tiles: {
    flexDirection: 'row',
    gap: Space.xxs,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH / PhotoAspect,
  },
  hidden: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.xs,
    borderCurve: 'continuous',
  },
  finale: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.sm,
  },
  // The match rises a little above the popped seats, like the last balloon in the room bar.
  risen: {
    marginBottom: 6,
  },
});
