import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Match } from '@/api';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, MinTouch, Space, type Seat } from '@/constants/theme';
import { MoreButton, usePersonActions } from '@/features/chat/person-actions';
import { Aura } from '@/features/match/aura';
import { PhotoCard } from '@/features/match/photo-card';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatAt, seatFor, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { useSession } from '@/state/session';
import { track } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';

/** How you ended up here. Null when the match was opened from Home. */
type Role = 'popper' | 'winner' | null;

/** A room has five balloons and four rounds; used until the room itself answers. */
const DEFAULT_PEOPLE = 5;
const DEFAULT_ROUNDS = 4;

/** The handoff draws this screen 390 pt wide. Everything on the stage scales with the width. */
const DESIGN_WIDTH = 390;
/** The kicker sits 84 pt from the phone's top edge, the stage 130 pt, the title 520 pt. */
const KICKER_TOP = 84;
const STAGE_TOP = 130;
const STAGE_HEIGHT = 380;
/** The chooser's card on the left, the winner's on the right, tilted apart. */
const CHOOSER_CARD = { left: 50, top: 80, width: 150, height: 230, radius: 18, tilt: -6 };
const WINNER_CARD = { left: 150, top: 20, width: 190, height: 290, radius: 20, tilt: 5 };

/** A card flies in from 60 pt below, untwisting to its tilt, 1.1 s, 200 ms after the other. */
function cardIn(tilt: number, delay: number) {
  return webSafeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 60 }, { rotate: `${tilt * 2.3}deg` }, { scale: 0.9 }] },
      100: {
        opacity: 1,
        transform: [{ translateY: 0 }, { rotate: `${tilt}deg` }, { scale: 1 }],
        easing: Ease.rise,
      },
    })
      .duration(1100)
      .delay(delay),
  );
}
const chooserIn = cardIn(CHOOSER_CARD.tilt, 500);
const winnerIn = cardIn(WINNER_CARD.tilt, 700);

/** The title fades up from 20 pt at 1.3 s, once the cards have landed. */
const titleIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 20 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
  })
    .duration(900)
    .delay(1300),
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

function MatchMoment({ match, role }: { match: Match; role: Role }) {
  const t = useT();
  const theme = useTheme();
  // Report, block or unmatch them; the last two end the match moment.
  const actions = usePersonActions({ onGone: goHome });
  const seats = useSeats();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const room = useRoom(match.roomId);
  const reduced = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const celebrated = useRef(false);

  // Straight from the game, everything flies in with one success haptic.
  // Opened again from Home, the screen is simply there.
  const fresh = role !== null;
  const animate = fresh && !reduced;

  useEffect(() => {
    track('match_opened');
  }, [match.id]);

  useEffect(() => {
    if (!fresh || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [fresh]);

  const { name, age } = match.other;
  const hero =
    role === 'popper'
      ? t('match.youChose', { name })
      : role === 'winner'
        ? t('match.choseYou', { name })
        : t('match.youAnd', { name });
  const people = numberWord(t, room?.contestants.length ?? DEFAULT_PEOPLE);
  const rounds = numberWord(t, room?.totalRounds ?? DEFAULT_ROUNDS);

  // A player's balloon, once the room says who sat where.
  function roomSeat(playerId: string | null | undefined): Seat | null {
    if (!room || !playerId) return null;
    const index = room.contestants.findIndex((contestant) => contestant.id === playerId);
    return index >= 0 ? seatAt(seats, index) : null;
  }
  const theirSeat = roomSeat(match.other.id) ?? seatFor(seats, match.other.id);
  // You are crimson whenever you hold a balloon; a chooser has none, so you stay crimson.
  const yourSeat = roomSeat(profile?.id) ?? youSeat(seats);

  const them = {
    uri: match.other.photo,
    label: t('common.nameAge', { name, age }),
    seat: theirSeat,
    a11y: t('match.theirPhoto', { name }),
  };
  const you = profile
    ? {
        uri: profile.photos[0] ?? 'mock://you',
        label: t('common.you'),
        seat: yourSeat,
        a11y: t('match.yourPhoto'),
      }
    : null;
  // The chooser sits on the left, the last balloon on the right. From Home, you're on the left.
  const left = role === 'winner' ? them : you;
  const right = role === 'winner' ? you : them;

  // The stage is drawn edge to edge, so it scales with the screen, not the content.
  const stageWidth = Math.min(windowWidth, MaxContentWidth);
  const scale = stageWidth / DESIGN_WIDTH;
  const at = (value: number) => Math.round(value * scale);
  const top = Math.max(Space.sm, KICKER_TOP - insets.top);

  return (
    <Screen
      footerStyle="plain"
      contentStyle={[styles.content, { paddingTop: top }]}
      footer={
        <>
          <Button
            title={t('match.sayHi')}
            accessibilityHint={t('match.sayHiHint', { name })}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
          />
          <Button
            title={t('match.recap')}
            variant="plain"
            onPress={() => router.push(`/recap/${match.roomId}` as Href)}
          />
        </>
      }>
      {/* Two auras in the match's colors, drifting behind everything. */}
      <View style={[styles.auras, { left: -Gutter, width: stageWidth }]} pointerEvents="none">
        <Aura
          color={left?.seat.color ?? theirSeat.color}
          size={at(360)}
          blur={90}
          opacity={0.32}
          left={at(-80)}
          top={at(120) - KICKER_TOP}
          drift={{ x: 30, y: -20, scale: 1.15 }}
          duration={9000}
        />
        <Aura
          color={right?.seat.color ?? theirSeat.color}
          size={at(380)}
          blur={100}
          opacity={0.28}
          left={stageWidth - at(380) + at(100)}
          top={at(300) - KICKER_TOP}
          drift={{ x: -40, y: 30, scale: 1.2 }}
          duration={11000}
        />
      </View>

      {/* Swipe-back is off on the match, so this is the way out besides chat and recap. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('match.backHome')}
        onPress={goHome}
        hitSlop={8}
        style={({ pressed }) => [styles.close, { top: top - 12 }, pressed && styles.pressed]}>
        <Icon name="close" size={18} color={theme.text} />
      </Pressable>
      <MoreButton
        label={t('chat.options')}
        hint={t('chat.optionsHint', { name: match.other.name })}
        disabled={actions.busy}
        onPress={() =>
          void actions.open({
            id: match.other.id,
            name: match.other.name,
            age: match.other.age,
            matchId: match.id,
          })
        }
        style={[styles.more, { top: top - 12 }]}
      />
      {actions.element}
      <ThemedText type="kicker" style={styles.kicker}>
        {t('match.lastBalloon')}
      </ThemedText>

      <View
        style={[
          styles.stage,
          { marginLeft: -Gutter, width: stageWidth, height: at(STAGE_HEIGHT), marginTop: at(STAGE_TOP - KICKER_TOP) - 18 },
        ]}>
        {left ? (
          <Animated.View
            entering={animate ? chooserIn : undefined}
            style={[
              styles.slot,
              { left: at(CHOOSER_CARD.left), top: at(CHOOSER_CARD.top), transform: [{ rotate: `${CHOOSER_CARD.tilt}deg` }] },
            ]}>
            <PhotoCard
              uri={left.uri}
              label={left.label}
              seat={left.seat}
              width={at(CHOOSER_CARD.width)}
              height={at(CHOOSER_CARD.height)}
              radius={CHOOSER_CARD.radius}
              accessibilityLabel={left.a11y}
            />
          </Animated.View>
        ) : null}
        {right ? (
          <Animated.View
            entering={animate ? winnerIn : undefined}
            style={[
              styles.slot,
              { left: at(WINNER_CARD.left), top: at(WINNER_CARD.top), transform: [{ rotate: `${WINNER_CARD.tilt}deg` }] },
            ]}>
            <PhotoCard
              uri={right.uri}
              label={right.label}
              seat={right.seat}
              width={at(WINNER_CARD.width)}
              height={at(WINNER_CARD.height)}
              radius={WINNER_CARD.radius}
              accessibilityLabel={right.a11y}
            />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={animate ? titleIn : undefined} style={styles.title}>
        <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {hero}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.sub}>
          {t('match.outOf', { people, rounds })}
        </ThemedText>
      </Animated.View>
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
  auras: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  kicker: {
    textAlign: 'center',
  },
  more: {
    position: 'absolute',
    right: Gutter - 12,
    zIndex: 2,
  },
  close: {
    position: 'absolute',
    left: Gutter - 12,
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  stage: {
    position: 'relative',
  },
  slot: {
    position: 'absolute',
  },
  title: {
    gap: 10,
    marginTop: Space.xs,
  },
  // Body 16/22 in the handoff.
  sub: {
    fontSize: 16,
    lineHeight: 22,
  },
});
