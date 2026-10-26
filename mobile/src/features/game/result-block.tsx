import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import type { Contestant, RoomPlayer } from '@/api';
import { Photo, PhotoBadge, type PhotoTone } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { useNeutralTone } from '@/features/game/popper-presence';
import { useTheme } from '@/hooks/use-theme';

/**
 * The pair as drawn on the 375pt canvas, in points from the content column's left
 * edge and the winner photo's top edge. It scales with the column's width.
 */
const DESIGN_WIDTH = 375 - Gutter * 2;
const WINNER = { left: 92, width: 240, height: 320, initial: 56 };
/** The popper's portrait, 90 x 120 inside a 3pt page-colored border, tilted over the winner's corner. */
const PORTRAIT = { left: 18, top: 206, width: 96, height: 126, border: 3, initial: 32 };
const TILT = '-6deg';
/** Down to the tilted portrait's lowest corner, ring included. */
const DESIGN_HEIGHT = 338;
/** From the line under the title to the winner's photo. */
const COMPOSITION_TOP = 50;
/** On a wide screen the pair grows a little, then stays put. */
const MAX_SCALE = 1.2;
/** Someone with no photo out yet: Photo draws their initial for mock URIs. */
const NO_PHOTO = 'mock://none';

const resultIn = FadeIn.duration(Motion.enter).easing(Ease.out).reduceMotion(ReduceMotion.Never);

type Viewer = 'popper' | 'winner' | 'other';

type ResultBlockProps = {
  popper: RoomPlayer;
  /** The last balloon. Missing when the room ended before anyone won. */
  winner: Contestant | undefined;
  /** The winner's seat (`seatAt(seats, index)`), for their tile. */
  winnerTone?: PhotoTone;
  /** Rounds played. */
  rounds: number;
  /** Who is looking: changes "Lena" into "You" or "you". */
  viewer: Viewer;
};

/**
 * The game's result, in place of the last pop once the room is finished: the line,
 * then the winner's photo with the popper's portrait tilted over its corner. It adds
 * no outer padding: the room sets it 32 below the room bar, inside the gutters.
 */
export function ResultBlock({ popper, winner, winnerTone, rounds, viewer }: ResultBlockProps) {
  if (!winner) {
    return (
      <Animated.View entering={resultIn} style={styles.copy}>
        <ThemedText type="display" accessibilityRole="header">
          The room ended early
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          No match this time.
        </ThemedText>
      </Animated.View>
    );
  }

  const chooser = viewer === 'popper' ? 'You' : popper.name;
  const chosen = viewer === 'winner' ? 'you' : winner.name;

  return (
    <Animated.View entering={resultIn}>
      <View style={styles.copy}>
        <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          {chooser} chose {chosen}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          Last balloon standing after {rounds} {rounds === 1 ? 'round' : 'rounds'}
        </ThemedText>
      </View>
      <Pair popper={popper} winner={winner} winnerTone={winnerTone} viewer={viewer} />
    </Animated.View>
  );
}

/** "Your photo 4", "Elias, photo 4", or just who it is before any photo is out. */
function photoLabel(name: string, isYou: boolean, photo: number) {
  if (photo === 0) return isYou ? 'You' : name;
  return isYou ? `Your photo ${photo}` : `${name}, photo ${photo}`;
}

type PairProps = {
  popper: RoomPlayer;
  winner: Contestant;
  winnerTone?: PhotoTone;
  viewer: Viewer;
};

/** The winner's latest photo, and the popper's portrait leaning on it. */
function Pair({ popper, winner, winnerTone, viewer }: PairProps) {
  const theme = useTheme();
  const neutral = useNeutralTone();
  const { width: windowWidth } = useWindowDimensions();
  // Measured on layout. Until then, what the room's gutters leave of this window.
  const [columnWidth, setColumnWidth] = useState<number | null>(null);
  const available = columnWidth ?? Math.min(windowWidth, MaxContentWidth) - Gutter * 2;
  const scale = Math.min(available / DESIGN_WIDTH, MAX_SCALE);
  const pt = (value: number) => value * scale;

  const tone = winnerTone ?? neutral;
  const shown = winner.photos.length;
  const winnerPhoto = winner.photos[shown - 1];
  const popperPhoto = popper.photos[0];
  const winnerLabel = photoLabel(winner.name, viewer === 'winner', shown);
  const popperLabel = photoLabel(popper.name, viewer === 'popper', popperPhoto ? 1 : 0);

  return (
    <View
      style={styles.column}
      onLayout={(event) => setColumnWidth(event.nativeEvent.layout.width)}>
      <View style={{ width: pt(DESIGN_WIDTH), height: pt(DESIGN_HEIGHT) }}>
        <View
          style={[
            styles.placed,
            {
              left: pt(WINNER.left),
              top: 0,
              width: pt(WINNER.width),
              height: pt(WINNER.height),
            },
          ]}>
          <Photo
            uri={winnerPhoto ?? NO_PHOTO}
            name={winner.name}
            tone={tone}
            hairline={false}
            initialSize={pt(WINNER.initial)}
            accessibilityLabel={winnerLabel}
            style={styles.winnerPhoto}
          />
          {winnerPhoto ? (
            <PhotoBadge label={viewer === 'winner' ? `Photo ${shown} · You` : `Photo ${shown}`} />
          ) : null}
          <View
            pointerEvents="none"
            style={[styles.ring, { borderRadius: Radius.md + 1, borderColor: theme.borderStrong }]}
          />
        </View>
        {/* Drawn last, so it lies over the winner's corner. */}
        <View
          style={[
            styles.placed,
            styles.portrait,
            {
              left: pt(PORTRAIT.left),
              top: pt(PORTRAIT.top),
              width: pt(PORTRAIT.width),
              height: pt(PORTRAIT.height),
              backgroundColor: theme.page,
            },
          ]}>
          <Photo
            uri={popperPhoto ?? NO_PHOTO}
            name={popper.name}
            tone={neutral}
            hairline={false}
            initialSize={pt(PORTRAIT.initial)}
            accessibilityLabel={popperLabel}
            style={styles.portraitPhoto}
          />
          <View
            pointerEvents="none"
            style={[styles.ring, { borderRadius: Radius.md + 1, borderColor: theme.borderStrong }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: Space.xs,
  },
  // Centers the pair once it stops growing on a wide screen.
  column: {
    alignItems: 'center',
    marginTop: COMPOSITION_TOP,
  },
  placed: {
    position: 'absolute',
  },
  winnerPhoto: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.md,
  },
  // The page shows as a border between the two photos.
  portrait: {
    padding: PORTRAIT.border,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    transform: [{ rotate: TILT }],
  },
  portraitPhoto: {
    flex: 1,
    borderRadius: Radius.md - PORTRAIT.border,
  },
  // A 1pt ring just outside the edge, as on the canvas.
  ring: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
});
