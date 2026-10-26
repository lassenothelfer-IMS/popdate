import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Match } from '@/api';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { Photo } from '@/components/photo';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { useRoom } from '@/hooks/use-server';
import { seatAt, seatFor, useScheme, useSeats, useTheme } from '@/hooks/use-theme';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** How you ended up here. Null when the match was opened from Home. */
type Role = 'popper' | 'winner' | null;

/** A room has five balloons and four rounds; used until the room itself answers. */
const DEFAULT_PEOPLE = 5;
const DEFAULT_ROUNDS = 4;

/**
 * The canvas draws this screen on a 375 x 812 phone. The header starts 84pt from
 * the phone's top edge, so it sits the same distance under any status bar.
 */
const CANVAS_HEIGHT = 812;
const HEADER_TOP = 84;
/** From the end of the body line (y 184) to the top of their photo (y 292). */
const STAGE_GAP = 108;
/**
 * The composition, measured from the content's left edge (x 20) and their photo's
 * top (y 292), at a 335pt content width. Everything scales with the stage's width.
 * The stage is 338 tall so your tilted portrait's lowest corner stays inside it.
 */
const STAGE = { width: 335, height: 338 };
const THEIRS = { left: 92, top: 0, width: 240, height: 320, initial: 56 };
/** Your photo's own size; left and top place the page-colored border around it. */
const YOURS = { left: 18, top: 206, width: 90, height: 120, initial: 32 };
const LAST_BALLOON = { left: 40, top: 38, size: 28 };
const PORTRAIT_BORDER = 3;
const TILT = '-6deg';
/**
 * The portraits land over 300 ms (motionPlan, "Match arrival"). Motion has no arrival
 * token, so this borrows the 300 ms burst token rather than a bare number.
 */
const ARRIVAL_MS = Motion.burst;

// A fresh arrival, in order: their photo, your portrait, the line, the balloon.
const theirPhotoIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.97 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Ease.out },
  }).duration(ARRIVAL_MS),
);

const yourPortraitIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 24 }, { rotate: '0deg' }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { rotate: TILT }], easing: Ease.out },
  })
    .duration(ARRIVAL_MS)
    .delay(60),
);

const lineIn = FadeIn.duration(Motion.state).delay(120).easing(Ease.out);

const balloonIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.out },
  })
    .duration(Motion.enter)
    .delay(180),
);

/** Reduce Motion: everything mounts in place, already tilted, and only fades. */
const fadeOnly = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The balloon waits for the room to know its color, so it fades in when that lands. */
const balloonSettles = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function numberWord(value: number) {
  return NUMBER_WORDS[value] ?? String(value);
}

export function MatchScreen({ matchId }: { matchId: string }) {
  // The game room passes `as` when it hands over; Home doesn't.
  const params = useLocalSearchParams<{ as?: string }>();
  const as = Array.isArray(params.as) ? params.as[0] : params.as;
  const role: Role = as === 'popper' || as === 'winner' ? as : null;
  const [match, setMatch] = useState<Match | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    api.getMatch(matchId).then((found) => {
      if (active) setMatch(found);
    });
    return () => {
      active = false;
    };
  }, [matchId]);

  if (match === undefined) return <LoadingScreen label="Loading your match" />;

  if (match === null) {
    return (
      <Screen
        scroll
        contentStyle={styles.centered}
        footerStyle="plain"
        footer={<Button title="Back to home" onPress={goHome} />}>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          This match doesn&apos;t exist.
        </ThemedText>
      </Screen>
    );
  }

  return <MatchMoment match={match} role={role} />;
}

function MatchMoment({ match, role }: { match: Match; role: Role }) {
  const theme = useTheme();
  const scheme = useScheme();
  const seats = useSeats();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const room = useRoom(match.roomId);
  const reduced = useReduceMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** The width the content really has (a web scrollbar takes some); null until measured. */
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const celebrated = useRef(false);

  // Straight from the game: the portraits land with one success haptic.
  // Opened again from Home, the screen is simply there.
  const fresh = role !== null;
  const motion = !fresh ? 'none' : reduced ? 'fade' : 'full';

  useEffect(() => {
    if (!fresh || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [fresh]);

  const name = match.other.name;
  const hero =
    role === 'popper' ? `You chose ${name}` : role === 'winner' ? `${name} chose you` : `You and ${name}`;
  const people = numberWord(room?.contestants.length ?? DEFAULT_PEOPLE);
  const rounds = numberWord(room?.totalRounds ?? DEFAULT_ROUNDS);
  const sub = fresh ? `Out of ${people} people, over ${rounds} rounds.` : null;

  // A player's seat, once the room says who sat where.
  function roomSeat(playerId: string | null | undefined) {
    if (!room || !playerId) return null;
    const index = room.contestants.findIndex((contestant) => contestant.id === playerId);
    return index >= 0 ? seatAt(seats, index) : null;
  }
  // Their seat in the room, or their own steady hue (a popper has no seat).
  const theirSeat = roomSeat(match.other.id) ?? seatFor(seats, match.other.id);
  // The last balloon is the winner's: theirs when you chose, yours when you were chosen.
  // It waits while the room loads, so it never lands in one color and turns another.
  const winnerId =
    room?.winnerId ?? (role === 'popper' ? match.other.id : role === 'winner' ? profile?.id : null);
  const lastSeat =
    room === undefined || !winnerId ? null : (roomSeat(winnerId) ?? seatFor(seats, winnerId));
  // Your own photo sits on the neutral tile, not a seat hue.
  const yourTone = {
    color: theme.text,
    tint: scheme === 'dark' ? theme.surfacePressed : theme.surface,
  };

  // The canvas's composition, scaled to the width the content has. The window gives a
  // first guess so nothing waits a frame; the measured width corrects it. A wide but
  // short window (a laptop browser, a tablet on its side) grows it only as far as its
  // height allows, so the photos stay above the fold.
  const available = measuredWidth ?? Math.min(windowWidth, MaxContentWidth) - Gutter * 2;
  const scale = Math.min(available / STAGE.width, Math.max(1, windowHeight / CANVAS_HEIGHT));
  const at = (value: number) => Math.round(value * scale);
  const ring = `0 0 0 1px ${theme.borderStrong}`;

  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={[styles.content, { paddingTop: Math.max(Space.sm, HEADER_TOP - insets.top) }]}
      footer={<Button title="Done" onPress={goHome} />}>
      <Animated.View entering={motion === 'full' ? lineIn : motion === 'fade' ? fadeOnly : undefined}>
        <ThemedText type="callout" themeColor="textSecondary">
          Last balloon
        </ThemedText>
        <ThemedText
          type="hero"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={styles.hero}>
          {hero}
        </ThemedText>
        {sub ? (
          <ThemedText themeColor="textSecondary" style={styles.sub}>
            {sub}
          </ThemedText>
        ) : null}
      </Animated.View>

      {/* The canvas's gap, which gives way on a short phone so the photos fit without scrolling. */}
      <View style={[styles.gap, { maxHeight: at(STAGE_GAP) }]} />

      <View
        style={styles.stageFrame}
        onLayout={(event) => {
          const width = Math.floor(event.nativeEvent.layout.width);
          if (width > 0) setMeasuredWidth(width);
        }}>
        <View style={{ width: at(STAGE.width), height: at(STAGE.height) }}>
          <Animated.View
            entering={motion === 'full' ? theirPhotoIn : motion === 'fade' ? fadeOnly : undefined}
            style={[
              styles.theirPhoto,
              { left: at(THEIRS.left), top: at(THEIRS.top), boxShadow: ring },
            ]}>
            <Photo
              uri={match.other.photo}
              accessibilityLabel={`${name}, photo 1`}
              name={name}
              tone={theirSeat}
              hairline={false}
              initialSize={at(THEIRS.initial)}
              style={{ width: at(THEIRS.width), height: at(THEIRS.height), borderRadius: Radius.md }}
            />
          </Animated.View>

          {profile ? (
            <Animated.View
              entering={motion === 'full' ? yourPortraitIn : motion === 'fade' ? fadeOnly : undefined}
              style={[
                styles.yourPortrait,
                {
                  left: at(YOURS.left),
                  top: at(YOURS.top),
                  backgroundColor: theme.page,
                  boxShadow: ring,
                },
              ]}>
              <Photo
                uri={profile.photos[0]}
                accessibilityLabel="Your photo 1"
                name={profile.name}
                tone={yourTone}
                hairline={false}
                initialSize={at(YOURS.initial)}
                style={{
                  width: at(YOURS.width),
                  height: at(YOURS.height),
                  borderRadius: Radius.md - PORTRAIT_BORDER,
                }}
              />
            </Animated.View>
          ) : null}

          {lastSeat ? (
            <Animated.View
              entering={motion === 'full' ? balloonIn : motion === 'fade' ? fadeOnly : balloonSettles}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.balloon, { left: at(LAST_BALLOON.left), top: at(LAST_BALLOON.top) }]}>
              <Balloon color={lastSeat.color} size={at(LAST_BALLOON.size)} shine={false} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
  },
  // Spacing from the canvas: 6 under the callout, 10 under the hero.
  hero: {
    marginTop: 6,
  },
  sub: {
    marginTop: 10,
  },
  gap: {
    flexGrow: 1,
    minHeight: Space.xl,
  },
  // Stretches to the content width whatever the stage inside it measures.
  stageFrame: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // The ring is a box shadow here, outside the photo's clipping, like the canvas's 1pt edge.
  theirPhoto: {
    position: 'absolute',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  // A page-colored border so the two photos overlap cleanly; concentric, 12 = 9 + 3.
  // The tilt lives here at rest, and the arrival keyframe ends on the same transform.
  yourPortrait: {
    position: 'absolute',
    padding: PORTRAIT_BORDER,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    transform: [{ translateX: 0 }, { rotate: TILT }],
  },
  balloon: {
    position: 'absolute',
  },
});
