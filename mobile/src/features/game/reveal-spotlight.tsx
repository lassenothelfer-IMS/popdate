import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';

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
/** The photo's largest share of the screen's height. */
const PHOTO_MAX_HEIGHT = 0.4;
const photoIn = FadeIn.duration(REVEAL_PHOTO_IN_MS).easing(Ease.out).reduceMotion(ReduceMotion.Never);

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
  const window = useWindowDimensions();
  // The photo stays within 40% of the screen's height, so it lands in view with the answer.
  const photoMaxWidth = window.height * PHOTO_MAX_HEIGHT * PhotoAspect + 2 * MY_PHOTO_FRAME;
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
          style={[
            styles.frame,
            {
              maxWidth: photoMaxWidth,
              backgroundColor: seat.tint,
              boxShadow: `inset 0 0 0 2px ${seat.color}`,
            },
          ]}>
          {photoShown ? (
            <Animated.View entering={photoIn}>
              <Photo
                uri={photo}
                name={contestant.name}
                tone={seat}
                style={styles.photo}
                accessibilityLabel={t('game.photoN', { n: position })}
              />
              <PhotoBadge label={t('game.photoN', { n: position })} />
            </Animated.View>
          ) : (
            <View style={[styles.photo, { backgroundColor: theme.field }]} />
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Space.lg,
    gap: Space.sm,
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
    width: '78%',
    alignSelf: 'center',
    padding: MY_PHOTO_FRAME,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  photo: {
    width: '100%',
    aspectRatio: PhotoAspect,
    borderRadius: Radius.card - MY_PHOTO_FRAME,
  },
});
