import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  Keyframe,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Match } from '@/api';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { Photo } from '@/components/photo';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Space } from '@/constants/theme';
import { useRoom } from '@/hooks/use-server';
import { useT, type Translate } from '@/i18n';
import { seatAt, seatFor, useScheme, useSeats, useTheme } from '@/hooks/use-theme';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
/** From the end of the body line to the top of the last balloon. */
const STAGE_GAP = 40;
/**
 * The composition from the Velvet hour match frame, measured from the content's
 * left edge and the balloon's top, at a 342pt content width. Everything scales
 * with the stage's width. Two paper prints overlap, tilted apart, and the last
 * balloon floats above them with its gold string tying the two together.
 */
const STAGE = { width: 342, height: 440 };
/** A print: the photo on a paper mat, 7pt round it and a 34pt foot for the caption. */
const MAT = 7;
const MAT_FOOT = 34;
const THEIRS = { left: 128, top: 112, width: 190, height: 253, initial: 64, tilt: '4deg' };
const YOURS = { left: 8, top: 240, width: 110, height: 147, initial: 36, tilt: '-7deg' };
const LAST_BALLOON = { left: 170, top: 0, size: 84 };
/** The string: from the balloon's knot, tied onto their print, ending on yours. */
const STRING_PATH = 'M212 92C206 118 168 124 160 150S138 222 112 254';
const TIES = [
  { x: 160, y: 150 },
  { x: 112, y: 254 },
] as const;
/** How long the string takes to draw itself once the prints have landed. */
const DRAW_MS = 1900;
const DRAW_DELAY = 900;
/** Long enough to cover the path's length in stage units. */
const STRING_LENGTH = 220;
/**
 * The portraits land over 300 ms (motionPlan, "Match arrival"). Motion has no arrival
 * token, so this borrows the 300 ms burst token rather than a bare number.
 */
const ARRIVAL_MS = Motion.burst;

/** Velvet hour's reveal and float-in curves. */
const Reveal = Easing.bezier(0.2, 0.8, 0.2, 1);
const FloatIn = Easing.bezier(0.16, 0.84, 0.24, 1);
const Draw = Easing.bezier(0.45, 0, 0.2, 1);

// A fresh arrival, in order: the line, the balloon rising, then the prints sliding in from either side.
const theirPhotoIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 150 }, { rotate: '14deg' }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { rotate: THEIRS.tilt }], easing: Reveal },
  })
    .duration(ARRIVAL_MS * 4)
    .delay(300),
);

const yourPortraitIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -150 }, { rotate: '-18deg' }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { rotate: YOURS.tilt }], easing: Reveal },
  })
    .duration(ARRIVAL_MS * 4)
    .delay(500),
);

const lineIn = FadeIn.duration(Motion.state * 3).easing(Ease.out);

const balloonIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 90 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: FloatIn },
  })
    .duration(1600)
    .delay(150),
);

/** Reduce Motion: everything mounts in place, already tilted, and only fades. */
const fadeOnly = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The balloon waits for the room to know its color, so it fades in when that lands. */
const balloonSettles = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

/** Counts up to ten are spelled out, as in "Out of five people"; past that, digits. */
function numberWord(t: Translate, value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 10 ? t(`match.n${value}`) : String(value);
}

export function MatchScreen({ matchId }: { matchId: string }) {
  // The game room passes `as` when it hands over; Home doesn't.
  const params = useLocalSearchParams<{ as?: string }>();
  const as = Array.isArray(params.as) ? params.as[0] : params.as;
  const role: Role = as === 'popper' || as === 'winner' ? as : null;
  const t = useT();
  const [match, setMatch] = useState<Match | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    api.getMatch(matchId).then(
      (found) => {
        if (active) setMatch(found);
      },
      () => {
        if (active) setMatch(null);
      },
    );
    return () => {
      active = false;
    };
  }, [matchId]);

  if (match === undefined) return <LoadingScreen label={t('match.loading')} />;

  if (match === null) {
    return (
      <Screen
        scroll
        contentStyle={styles.centered}
        footerStyle="plain"
        footer={<Button title={t('match.backHome')} onPress={goHome} />}>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {t('match.notFound')}
        </ThemedText>
      </Screen>
    );
  }

  return <MatchMoment match={match} role={role} />;
}

function MatchMoment({ match, role }: { match: Match; role: Role }) {
  const t = useT();
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
    role === 'popper'
      ? t('match.youChose', { name })
      : role === 'winner'
        ? t('match.choseYou', { name })
        : t('match.youAnd', { name });
  const people = numberWord(t, room?.contestants.length ?? DEFAULT_PEOPLE);
  const rounds = numberWord(t, room?.totalRounds ?? DEFAULT_ROUNDS);
  const sub = fresh ? t('match.outOf', { people, rounds }) : null;

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

  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={[styles.content, { paddingTop: Math.max(Space.sm, HEADER_TOP - insets.top) }]}
      footer={
        <>
          <Button
            title={t('match.sayHi')}
            accessibilityHint={t('match.sayHiHint', { name })}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
          />
          <Button title={t('common.done')} variant="ghost" onPress={goHome} />
        </>
      }>
      <Animated.View entering={motion === 'full' ? lineIn : motion === 'fade' ? fadeOnly : undefined}>
        <ThemedText type="kicker">{t('match.lastBalloon')}</ThemedText>
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
          {profile ? (
            <Animated.View
              entering={motion === 'full' ? yourPortraitIn : motion === 'fade' ? fadeOnly : undefined}
              style={[
                styles.print,
                {
                  left: at(YOURS.left),
                  top: at(YOURS.top),
                  padding: at(MAT),
                  paddingBottom: 0,
                  backgroundColor: theme.paper,
                  transform: [{ translateX: 0 }, { rotate: YOURS.tilt }],
                },
              ]}>
              <Photo
                uri={profile.photos[0]}
                accessibilityLabel={t('match.yourPhoto')}
                name={profile.name}
                tone={yourTone}
                hairline={false}
                initialSize={at(YOURS.initial)}
                style={{ width: at(YOURS.width), height: at(YOURS.height), borderRadius: 4 }}
              />
              <View style={[styles.caption, { height: at(MAT_FOOT) }]}>
                <ThemedText
                  type="captionStrong"
                  themeColor="onPaper"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}>
                  {profile.name}
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={motion === 'full' ? theirPhotoIn : motion === 'fade' ? fadeOnly : undefined}
            style={[
              styles.print,
              {
                left: at(THEIRS.left),
                top: at(THEIRS.top),
                padding: at(MAT),
                paddingBottom: 0,
                backgroundColor: theme.paper,
                transform: [{ translateX: 0 }, { rotate: THEIRS.tilt }],
              },
            ]}>
            <Photo
              uri={match.other.photo}
              accessibilityLabel={t('match.theirPhoto', { name })}
              name={name}
              tone={theirSeat}
              hairline={false}
              initialSize={at(THEIRS.initial)}
              style={{ width: at(THEIRS.width), height: at(THEIRS.height), borderRadius: 4 }}
            />
            <View style={[styles.caption, styles.captionEnd, { height: at(MAT_FOOT) }]}>
              <ThemedText
                type="captionStrong"
                themeColor="onPaper"
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}>
                {name}
              </ThemedText>
            </View>
          </Animated.View>

          {lastSeat ? (
            <>
              <MatchString scale={scale} motion={motion} />
              <Animated.View
                entering={motion === 'full' ? balloonIn : motion === 'fade' ? fadeOnly : balloonSettles}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.balloon, { left: at(LAST_BALLOON.left), top: at(LAST_BALLOON.top) }]}>
                <Balloon color={lastSeat.color} size={at(LAST_BALLOON.size)} string={false} />
              </Animated.View>
            </>
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
  // A paper print: the photo on its mat, the caption on the foot. The tilt lives on
  // the print at rest, and the arrival keyframe ends on the same transform.
  print: {
    position: 'absolute',
    borderRadius: 8,
    borderCurve: 'continuous',
    boxShadow: '0 12px 28px rgba(18, 4, 10, 0.55)',
  },
  caption: {
    justifyContent: 'center',
  },
  captionEnd: {
    alignItems: 'flex-end',
  },
  balloon: {
    position: 'absolute',
  },
  string: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

/**
 * The gold string from the last balloon's knot, tied onto their print and ending
 * on yours. On a fresh match it draws itself once the prints have landed and the
 * ties pop in; otherwise it is simply there.
 */
function MatchString({ scale, motion }: { scale: number; motion: 'none' | 'fade' | 'full' }) {
  const theme = useTheme();
  const drawn = useSharedValue(motion === 'full' ? 0 : 1);
  useEffect(() => {
    if (motion !== 'full') return;
    drawn.set(withDelay(DRAW_DELAY, withTiming(1, { duration: DRAW_MS, easing: Draw })));
  }, [motion, drawn]);
  const line = useAnimatedProps(() => ({
    strokeDashoffset: STRING_LENGTH * (1 - drawn.get()),
  }));
  const ties = useAnimatedProps(() => ({
    opacity: drawn.get() > 0.98 ? 1 : 0,
  }));
  return (
    <Svg
      width={STAGE.width * scale}
      height={STAGE.height * scale}
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      style={styles.string}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AnimatedPath
        d={STRING_PATH}
        stroke={theme.gold}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={[STRING_LENGTH, STRING_LENGTH]}
        animatedProps={line}
      />
      {TIES.map((tie) => (
        <AnimatedCircle
          key={`${tie.x}-${tie.y}`}
          cx={tie.x}
          cy={tie.y}
          r={3}
          fill={theme.gold}
          animatedProps={ties}
        />
      ))}
    </Svg>
  );
}
