import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Avatar } from '@/components/avatar';
import { PoppedMark } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Ease, lacquerFor, Motion, Space } from '@/constants/theme';
import { YouTag } from '@/features/game/you-tag';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';

const ROW_HEIGHT = 56;
/** The column every row's mark sits in: a dot, the answered check or the popped mark. */
const MARK_BOX = 20;
const DOT = 10;
const POPPED_MARK = 14;
/** Once their photo is out, it takes the dot's place, in a ring of their balloon color. */
const PHOTO = 40;
const PHOTO_BOX = 48;
const BADGE = 18;
/** One pass of the Writing dots. */
const DOTS_MS = 1200;
/** Where in a pass each dot starts to show, and how long a dot takes to fade. */
const DOT_STARTS = [0.1, 0.3, 0.5];
const DOT_FADE = 0.12;

/** Small changes inside a row: the Answered check, a row arriving in the Popped group. */
const quietIn = FadeIn.duration(Motion.watch).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** "Lena, 27", with ", you" on your own row. */
function whoLabel(t: Translate, contestant: Contestant, isMe: boolean) {
  const nameAge = t('common.nameAge', { name: contestant.name, age: contestant.age });
  return isMe ? t('game.rowYou', { nameAge }) : nameAge;
}

type LiveRowProps = {
  contestant: Contestant;
  color: string;
  isMe: boolean;
  /** While answers come in, for everyone in the room. */
  status?: 'answered' | 'writing';
};

/** Someone still in: their dot, name and age, and while answering whether they answered. */
export function LiveRow({ contestant, color, isMe, status }: LiveRowProps) {
  const theme = useTheme();
  const t = useT();
  const answered = status === 'answered';
  const writing = status === 'writing';
  const photo = contestant.photos.at(-1);
  return (
    <View
      accessible
      accessibilityLabel={[
        whoLabel(t, contestant, isMe),
        answered ? t('game.answered') : writing ? t('game.writing') : null,
      ]
        .filter(Boolean)
        .join('. ')}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      {photo ? (
        <RowPhoto contestant={contestant} color={color} photo={photo}>
          {answered ? (
            <Animated.View
              entering={quietIn}
              style={[styles.badge, { backgroundColor: theme.successFill, borderColor: theme.page }]}>
              <Icon name="check" size={9} color={theme.onInverse} />
            </Animated.View>
          ) : null}
        </RowPhoto>
      ) : answered ? (
        <Animated.View
          entering={quietIn}
          style={[styles.check, { backgroundColor: theme.successFill }]}>
          <Icon name="check" size={12} color={theme.onInverse} />
        </Animated.View>
      ) : (
        <View style={styles.markBox}>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      )}
      <View style={styles.name}>
        {writing ? (
          // Still writing: the whole line steps back.
          <ThemedText type="row" themeColor="textSecondary" style={styles.shrink}>
            {contestant.name}, {contestant.age}
          </ThemedText>
        ) : (
          <ThemedText type="row" style={styles.shrink}>
            {contestant.name},{' '}
            <ThemedText type="row" themeColor="textSecondary" style={styles.age}>
              {contestant.age}
            </ThemedText>
          </ThemedText>
        )}
        {isMe ? <YouTag /> : null}
      </View>
      {answered ? (
        <Animated.View entering={quietIn}>
          <ThemedText type="footnote" themeColor="success">
            {t('game.answered')}
          </ThemedText>
        </Animated.View>
      ) : writing ? (
        <View style={styles.writing}>
          <ThemedText type="footnote" themeColor="textSecondary">
            {t('game.writing')}
          </ThemedText>
          <WritingDots />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The "…" after Writing: the dots come in one after another and clear together,
 * once every 1.2 s. Under Reduce Motion all three simply stay. The row's label
 * reads "Writing" without them.
 */
function WritingDots() {
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress);
      return;
    }
    progress.set(0);
    progress.set(withRepeat(withTiming(1, { duration: DOTS_MS, easing: Easing.linear }), -1, false));
  }, [reduced, progress]);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <WritingDot key={index} index={index} progress={progress} still={reduced} />
      ))}
    </View>
  );
}

function WritingDot({
  index,
  progress,
  still,
}: {
  index: number;
  progress: SharedValue<number>;
  still: boolean;
}) {
  const start = DOT_STARTS[index];
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1 };
    const p = progress.get();
    const shown = interpolate(p, [start, start + DOT_FADE], [0, 1], Extrapolation.CLAMP);
    const cleared = interpolate(p, [1 - DOT_FADE, 1], [1, 0], Extrapolation.CLAMP);
    return { opacity: shown * cleared };
  });
  return (
    <Animated.View style={style}>
      <ThemedText type="footnote" themeColor="textSecondary">
        .
      </ThemedText>
    </Animated.View>
  );
}

type PoppedRowProps = {
  contestant: Contestant;
  color: string;
  isMe: boolean;
  /** The round it popped in; for a pop still on its way, the round being played. */
  round: number | null;
  /** The last row of the group draws no hairline under it. */
  last: boolean;
};

/** Popped or left: the popped mark in their hue, quiet, and nobody is singled out. */
export function PoppedRow({ contestant, color, isMe, round, last }: PoppedRowProps) {
  const theme = useTheme();
  const t = useT();
  const photo = contestant.photos.at(-1);
  const what = contestant.left
    ? round
      ? t('game.leftInRound', { round })
      : t('game.left')
    : round
      ? t('game.poppedInRound', { round })
      : t('game.popped');
  return (
    <Animated.View
      entering={quietIn}
      accessible
      accessibilityLabel={`${whoLabel(t, contestant, isMe)}. ${what}`}
      style={[styles.row, { borderBottomColor: theme.border }, last && styles.lastRow]}>
      {photo ? (
        <RowPhoto contestant={contestant} color={color} photo={photo} popped>
          <View style={[styles.badge, { backgroundColor: theme.page, borderColor: theme.page }]}>
            <PoppedMark color={color} size={POPPED_MARK} />
          </View>
        </RowPhoto>
      ) : (
        <View style={styles.markBox}>
          <PoppedMark color={color} size={POPPED_MARK} />
        </View>
      )}
      <View style={styles.name}>
        <ThemedText type="row" themeColor="textSecondary" style={styles.shrink}>
          {contestant.name}, {contestant.age}
        </ThemedText>
        {isMe ? <YouTag /> : null}
      </View>
      <ThemedText type="footnote" themeColor="textSecondary">
        {what}
      </ThemedText>
    </Animated.View>
  );
}

type RowPhotoProps = {
  contestant: Contestant;
  color: string;
  photo: string;
  /** Popped: the photo steps back and loses its ring. */
  popped?: boolean;
  /** A small badge on the photo's lower right: the answered check, or the popped mark. */
  children?: ReactNode;
};

/** Their newest revealed photo in a ring of their balloon color: 2 pt of canvas, then the color. */
function RowPhoto({ contestant, color, photo, popped = false, children }: RowPhotoProps) {
  const theme = useTheme();
  const seat = lacquerFor(color);
  return (
    <View style={styles.photoBox}>
      <View
        style={[
          styles.photo,
          {
            boxShadow: popped
              ? `0 0 0 1px ${theme.borderStrong}`
              : `0 0 0 2px ${theme.page}, 0 0 0 3.5px ${color}`,
          },
        ]}>
        <View style={popped ? styles.poppedPhoto : null}>
          <Avatar
            name={contestant.name}
            uri={photo}
            tone={seat ? { color: seat.color, tint: seat.tint } : undefined}
            size={PHOTO}
          />
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  photoBox: {
    width: PHOTO_BOX,
    height: PHOTO_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    borderRadius: PHOTO / 2,
  },
  poppedPhoto: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  markBox: {
    width: MARK_BOX,
    height: MARK_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  check: {
    width: MARK_BOX,
    height: MARK_BOX,
    borderRadius: MARK_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: Space.xxs,
  },
  shrink: {
    flexShrink: 1,
  },
  age: {
    fontWeight: 400,
  },
  writing: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dots: {
    flexDirection: 'row',
  },
});
