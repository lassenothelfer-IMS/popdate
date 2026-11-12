import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { api, type Match } from '@/api';
import { Balloon, balloonHeight } from '@/components/balloon';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LoadingScreen } from '@/components/loading-screen';
import { Photo } from '@/components/photo';
import { PhotoDisc } from '@/components/photo-disc';
import { Screen } from '@/components/screen';
import { Bob } from '@/components/stage';
import { TextLink } from '@/components/text-link';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MinTouch, Space, Velvet } from '@/constants/theme';
import { MoreButton, usePersonActions } from '@/features/chat/person-actions';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatAt, seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { track } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';

/** How you ended up here. Null when the match was opened from Home. */
type Role = 'popper' | 'winner' | null;

/** A room has five balloons and four rounds; used until the room itself answers. */
const DEFAULT_PEOPLE = 5;
const DEFAULT_ROUNDS = 4;

/** The photo takes this much of the screen's height; the words sit on deep plum under it. */
const PHOTO_SHARE = 0.62;
/** How far the plum climbs into the photo's foot, so there is no edge between them. */
const BLEND = 150;
/** The match opens out of the last balloon's face: a circle this wide, before it fills its frame. */
const FACE = 76;
const BALLOON = 96;
/** The balloon hangs a moment, then lifts off as the photo opens. */
const OPEN_DELAY = 900;
const OPEN_MS = 950;

/** The headline's words land one by one, each from a little below and a little tipped. */
function wordIn(index: number) {
  return webSafeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 26 }, { rotate: '3deg' }] },
      100: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '0deg' }], easing: Ease.rise },
    })
      .duration(620)
      .delay(OPEN_DELAY + OPEN_MS - 200 + index * 130),
  );
}
/** The line under it and the buttons follow once the words are down. */
const restIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 14 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
  })
    .duration(700)
    .delay(OPEN_DELAY + OPEN_MS + 500),
);

/** The counts that have a word: `match.n0` to `match.n10`. */
type Spelled = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Counts up to ten are spelled out, as in "Out of five people"; past that, digits. */
function numberWord(t: Translate, value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 10
    ? t(`match.n${value as Spelled}`)
    : String(value);
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

/**
 * The match: their photo is the whole screen, with who chose whom over it and
 * the way into the chat. Straight from the room it opens out of the last
 * balloon: the balloon hangs over their face for a beat, lifts off, and the
 * face widens until it fills the screen. Opened again later, it is simply there.
 */
function MatchMoment({ match, role }: { match: Match; role: Role }) {
  const t = useT();
  const theme = useTheme();
  // Report, block or unmatch them; the last two end the match moment.
  const actions = usePersonActions({ onGone: goHome });
  const seats = useSeats();
  const insets = useSafeAreaInsets();
  const room = useRoom(match.roomId);
  const reduced = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const celebrated = useRef(false);

  const fresh = role !== null;
  const animate = fresh && !reduced;
  /** 0: a face under a balloon. 1: the photo fills the screen. */
  const open = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    track('match_opened');
  }, [match.id]);

  useEffect(() => {
    if (!fresh || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [fresh]);

  useEffect(() => {
    if (!animate) return;
    open.set(withDelay(OPEN_DELAY, withTiming(1, { duration: OPEN_MS, easing: Easing.bezier(0.6, 0, 0.2, 1) })));
  }, [animate, open]);

  const { name, age } = match.other;
  const hero =
    role === 'popper'
      ? t('match.youChose', { name })
      : role === 'winner'
        ? t('match.choseYou', { name })
        : t('match.youAnd', { name });
  const people = numberWord(t, room?.contestants.length ?? DEFAULT_PEOPLE);
  const rounds = numberWord(t, room?.totalRounds ?? DEFAULT_ROUNDS);
  // Their balloon's color, once the room says who sat where.
  const seatIndex = room ? room.contestants.findIndex((contestant) => contestant.id === match.other.id) : -1;
  const seat = seatIndex >= 0 ? seatAt(seats, seatIndex) : seatFor(seats, match.other.id);

  const photoHeight = Math.round(height * PHOTO_SHARE);
  const faceTop = height * 0.4;
  const photo = useAnimatedStyle(() => {
    const at = open.get();
    return {
      width: FACE + (width - FACE) * at,
      height: FACE + (photoHeight - FACE) * at,
      left: ((width - FACE) / 2) * (1 - at),
      top: faceTop * (1 - at),
      borderRadius: (FACE / 2) * (1 - at),
    };
  });
  const lift = useAnimatedStyle(() => ({
    opacity: 1 - open.get(),
    transform: [{ translateY: -height * 0.6 * open.get() }],
  }));
  // What sits over the photo waits until there is a photo to sit on.
  const over = useAnimatedStyle(() => ({ opacity: Math.max(0, (open.get() - 0.6) / 0.4) }));

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      {/* The deep plum the words stand on, coming in as the photo opens. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.brandDeep }, over]} pointerEvents="none" />
      {animate ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.balloon, { top: faceTop - balloonHeight(BALLOON) + 6, left: (width - BALLOON) / 2 }, lift]}>
          <Bob>
            <Balloon color={seat.color} size={BALLOON} />
          </Bob>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.photo, photo]}>
        <Photo
          uri={match.other.photo}
          name={name}
          tone={seat}
          hairline={false}
          accessibilityLabel={t('match.theirPhoto', { name })}
          style={StyleSheet.absoluteFill}
        />
        {/* The plum climbs into the photo's foot. Sized in points: a percent-sized Svg collapses on the phone. */}
        <Animated.View style={[styles.blend, over]} pointerEvents="none">
          <Svg width={width} height={BLEND}>
            <Defs>
              <LinearGradient id="matchShade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.brandDeep} stopOpacity={0} />
                <Stop offset="1" stopColor={theme.brandDeep} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={BLEND} fill="url(#matchShade)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Swipe-back is off on the match, so this is the way out besides chat and recap. */}
      <Animated.View style={[styles.top, { top: insets.top + Space.xs }, over]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('match.backHome')}
          onPress={goHome}
          hitSlop={8}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
          <PhotoDisc radius={MinTouch / 2} />
          <Icon name="close" size={16} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.kicker}>{t('match.lastBalloon')}</ThemedText>
        <MoreButton
          label={t('chat.options')}
          hint={t('chat.optionsHint', { name })}
          disabled={actions.busy}
          onPress={() => void actions.open({ id: match.other.id, name, age, matchId: match.id })}
          style={styles.round}
          backdrop={<PhotoDisc radius={MinTouch / 2} />}
        />
      </Animated.View>
      {actions.element}

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, Space.md) + Space.xs }]}>
        <View accessible accessibilityRole="header" accessibilityLabel={hero} style={styles.words}>
          {hero.split(' ').map((word, index) => (
            <Animated.View key={`${word}-${index}`} entering={animate ? wordIn(index) : undefined}>
              <ThemedText type="hero" maxFontSizeMultiplier={1.3} style={styles.word}>
                {word}
              </ThemedText>
            </Animated.View>
          ))}
        </View>
        <Animated.View entering={animate ? restIn : undefined} style={styles.rest}>
          <ThemedText type="body" style={styles.sub}>
            {t('match.outOf', { people, rounds })}
          </ThemedText>
          <Button
            title={t('match.sayHi')}
            variant="tinted"
            accessibilityHint={t('match.sayHiHint', { name })}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
          />
          <View style={styles.recap}>
            <TextLink
              title={t('match.recap')}
              color={Velvet.cream}
              onPress={() => router.push(`/recap/${match.roomId}` as Href)}
            />
          </View>
        </Animated.View>
      </View>
    </View>
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
  root: {
    flex: 1,
  },
  balloon: {
    position: 'absolute',
    zIndex: 1,
  },
  photo: {
    position: 'absolute',
    overflow: 'hidden',
  },
  blend: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BLEND,
  },
  top: {
    position: 'absolute',
    left: Gutter - 4,
    right: Gutter - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  round: {
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Velvet.cream,
  },
  foot: {
    position: 'absolute',
    left: Gutter,
    right: Gutter,
    bottom: 0,
  },
  // The words wrap like a sentence; each is its own piece so it can land on its own.
  words: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 11,
  },
  word: {
    color: Velvet.cream,
    fontSize: 50,
    lineHeight: 52,
    letterSpacing: -1.4,
  },
  rest: {
    marginTop: Space.sm,
    gap: Space.md,
  },
  sub: {
    color: Velvet.cream,
  },
  recap: {
    alignItems: 'center',
    marginTop: -Space.xxs,
  },
});
