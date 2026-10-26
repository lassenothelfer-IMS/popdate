import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Photo, PhotoBadge, type PhotoTone } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion, PhotoAspect, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';

/** Short answers are set big; longer ones in the long-quote size. */
const SHORT_ANSWER = 90;
/** Where a photo settles from as it develops. Never from nothing. */
const DEVELOP_FROM = 0.97;
/** The red wash around your photo while it's showing. */
export const MY_PHOTO_FRAME = 6;

/** Someone's own words, in Gloock. Short answers are set big, longer ones smaller. */
export function Quote({ text }: { text: string }) {
  return (
    <ThemedText type={text.length <= SHORT_ANSWER ? 'quote' : 'quoteLong'}>
      {`“${text}”`}
    </ThemedText>
  );
}

/** "You asked" or "Mia asks" in red, and the round's question under it. */
export function QuestionBlock({ kicker, text }: { kicker: string; text: string }) {
  return (
    <View>
      <ThemedText type="kicker">{kicker}</ThemedText>
      <ThemedText type="question" style={styles.question}>
        {text}
      </ThemedText>
    </View>
  );
}

/** Why the photos are still hidden while answers come in. */
export function LockLine() {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={styles.lock}>
      <Icon name="lock" size={13} color={theme.textSecondary} />
      <ThemedText type="footnote" themeColor="textSecondary" style={styles.shrink}>
        {t('game.photosUnlock')}
      </ThemedText>
    </View>
  );
}

type MyPhotoProps = {
  uri: string;
  name: string;
  tone: PhotoTone;
  /** Which photo this is, 1 to 6. */
  position: number;
  /** It has come into view and shows. Until then it waits, so it develops where the eye is. */
  developed: boolean;
};

/** Your photo while the popper sees it, in a red wash. */
export function MyPhoto({ uri, name, tone, position, developed }: MyPhotoProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const t = useT();
  return (
    <View style={[styles.frame, { backgroundColor: theme.accentWash }]}>
      <Animated.View
        key={uri}
        style={{
          opacity: developed ? 1 : 0,
          transform: [{ scale: developed || reduced ? 1 : DEVELOP_FROM }],
          transitionProperty: reduced ? 'opacity' : ['opacity', 'transform'],
          transitionDuration: Motion.enter,
          transitionTimingFunction: CssEase.out,
        }}>
        <Photo
          uri={uri}
          name={name}
          tone={tone}
          style={styles.photo}
          accessibilityLabel={t('game.yourPhotoNow', { n: position })}
        />
        <PhotoBadge label={t('game.photoNYou', { n: position })} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  question: {
    marginTop: 6,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shrink: {
    flexShrink: 1,
  },
  frame: {
    padding: MY_PHOTO_FRAME,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  photo: {
    width: '100%',
    aspectRatio: PhotoAspect,
  },
});
