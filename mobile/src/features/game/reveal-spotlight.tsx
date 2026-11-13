import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Balloon } from '@/components/balloon';
import { Photo, PhotoBadge } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { Ease, PhotoAspect, Radius, Space, type Seat } from '@/constants/theme';
import { MY_PHOTO_FRAME, Quote } from '@/features/game/room-blocks';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { type Translate, useT } from '@/i18n';
import { REVEAL_CARD_IN_MS, REVEAL_PHOTO_IN_MS, revealReadMs } from '@/shared/reveal';
import { haptics } from '@/utils/haptics';
import { webSafeKeyframe } from '@/utils/web-motion';

/** Each turn's card slides in from the side, the way the next person steps up. */
const cardIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 28 }] },
    100: { opacity: 1, transform: [{ translateX: 0 }], easing: Ease.out },
  }).duration(REVEAL_CARD_IN_MS),
);
const cardFade = FadeIn.duration(REVEAL_CARD_IN_MS).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/** The photo's largest share of the page's width. */
const PHOTO_WIDTH = 0.78;
/** Below this the photo is too small to be worth it: the page scrolls instead. */
const PHOTO_MIN_HEIGHT = 180;
/** The space above and below the photo inside its area. */
const AREA_SPACING = Space.xs + Space.sm;
const photoIn = FadeIn.duration(REVEAL_PHOTO_IN_MS).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/** The plum cover over a photo not yet shown lifts straight up off it, like a cloth. */
const LIFT_MS = 700;
const lift = Easing.bezier(0.7, 0, 0.2, 1);

/** What a reveal turn says: "2 of 5. Mia, 27: …", for VoiceOver and TalkBack. */
export function revealLine(t: Translate, contestant: Contestant, index: number, total: number) {
  const who = `${t('game.revealOf', { n: index + 1, total })}. ${contestant.name}, ${contestant.age}`;
  return contestant.answer ? `${who}: ${contestant.answer}` : `${who}. ${t('game.noAnswer')}`;
}

type RevealSpotlightProps = {
  contestant: Contestant;
  seat: Seat;
  /** This turn's place in the reveal, from 0, and how many turns there are. */
  index: number;
  total: number;
  /** When this turn started, on the room's schedule. */
  startsAt: number;
  /** The photo has come up: the room's stage shows it on their face from now. */
  onPhotoShown?: () => void;
  isMe: boolean;
};

/**
 * One contestant in the live reveal: their balloon and name, their answer on its
 * own, then this round's photo. Every phone shows the same turn at the same time.
 * The parent keys it by contestant, so each turn enters fresh.
 */
export function RevealSpotlight({
  contestant,
  seat,
  index,
  total,
  startsAt,
  isMe,
  onPhotoShown,
}: RevealSpotlightProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const t = useT();
  // The room left under the answer. The photo fills as much of it as its shape allows.
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const frameWidth = area
    ? Math.min(area.width * PHOTO_WIDTH, (area.height - AREA_SPACING - 2 * MY_PHOTO_FRAME) * PhotoAspect + 2 * MY_PHOTO_FRAME)
    : 0;
  const photo = contestant.photos[contestant.photos.length - 1];
  const position = contestant.photos.length;

  // The photo waits until the answer has had its reading time. A turn joined late
  // shows it straight away.
  const photoAt = startsAt + REVEAL_CARD_IN_MS + revealReadMs(contestant.answer);
  const [photoShown, setPhotoShown] = useState(() => !photo || Date.now() >= photoAt);
  useEffect(() => {
    if (photoShown || !photo) return;
    const timer = setTimeout(() => {
      setPhotoShown(true);
      haptics.light();
    }, photoAt - Date.now());
    return () => clearTimeout(timer);
  }, [photoAt, photoShown, photo]);
  // 0 while the cover is on, 1 once it has lifted off. A turn joined late starts uncovered.
  const uncovered = useSharedValue(photoShown ? 1 : 0);
  useEffect(() => {
    if (!photoShown) return;
    uncovered.set(reduced ? 1 : withTiming(1, { duration: LIFT_MS, easing: lift }));
  }, [photoShown, reduced, uncovered]);
  const cover = useAnimatedStyle(() => ({
    opacity: interpolate(uncovered.get(), [0, 0.7, 1], [1, 1, 0]),
    transform: [{ translateY: `${-105 * uncovered.get()}%` }],
  }));
  const shown = useEffectEvent(() => onPhotoShown?.());
  useEffect(() => {
    if (photoShown) shown();
  }, [photoShown]);

  return (
    <Animated.View
      entering={reduced ? cardFade : cardIn}
      style={styles.card}
      accessible
      accessibilityLabel={revealLine(t, contestant, index, total)}>
      <ThemedText type="kicker">{t('game.revealOf', { n: index + 1, total })}</ThemedText>
      <View style={styles.who}>
        <Balloon color={seat.color} size={22} string={false} />
        <ThemedText type="heading" style={styles.shrink} numberOfLines={1}>
          {isMe ? t('game.revealYou', { name: contestant.name }) : `${contestant.name}, ${contestant.age}`}
        </ThemedText>
      </View>

      <View style={styles.answer}>
        {contestant.answer ? (
          <Quote text={contestant.answer} />
        ) : (
          <ThemedText type="callout" themeColor="textSecondary">
            {t('game.noAnswer')}
          </ThemedText>
        )}
      </View>

      {photo ? (
        <View
          style={styles.area}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (area?.width !== width || area.height !== height) setArea({ width, height });
          }}>
        {area ? (
        <View
          style={[
            styles.frame,
            {
              width: frameWidth,
              backgroundColor: seat.tint,
              boxShadow: `inset 0 0 0 2px ${seat.color}`,
            },
          ]}>
          {/* The photo loads under the cover, so it is there the moment the cover lifts. */}
          <View style={styles.window}>
            <Photo
              uri={photo}
              name={contestant.name}
              tone={seat}
              style={styles.photo}
              accessibilityLabel={photoShown ? t('game.photoN', { n: position }) : undefined}
            />
            {photoShown ? (
              <Animated.View entering={photoIn} style={StyleSheet.absoluteFill} pointerEvents="none">
                <PhotoBadge label={t('game.photoN', { n: position })} />
              </Animated.View>
            ) : null}
            <Animated.View
              style={[styles.cover, { backgroundColor: theme.brand }, cover]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Balloon color={seat.color} size={34} string={false} />
            </Animated.View>
          </View>
        </View>
        ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginTop: Space.lg,
    gap: Space.sm,
  },
  // Whatever height is left under the answer, down to the bottom of the page.
  area: {
    flex: 1,
    minHeight: PHOTO_MIN_HEIGHT,
    alignItems: 'center',
    paddingBottom: Space.sm,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  answer: {
    minHeight: 56,
  },
  frame: {
    marginTop: Space.xs,
    padding: MY_PHOTO_FRAME,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  // The cover lifts out through the top of this, so it clips to the photo's corners.
  window: {
    borderRadius: Radius.card - MY_PHOTO_FRAME,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: PhotoAspect,
    borderRadius: Radius.card - MY_PHOTO_FRAME,
  },
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
