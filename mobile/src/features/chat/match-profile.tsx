import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { api, type MatchProfile } from '@/api';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Photo } from '@/components/photo';
import { PressableScale } from '@/components/pressable-scale';
import { Rise } from '@/components/rise';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Gutter, PhotoGlass, Radius, Space, Velvet } from '@/constants/theme';
import { asSexuality, identityLabel, identityOf, sexualityLabel } from '@/features/profile/identity';
import { interestLabel, languageLabel } from '@/features/profile/tags-section';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { cleanInterests, cleanLanguages } from '@/shared/profile-tags';
import { useFilterText, useSettings } from '@/state/settings';
import { haptics } from '@/utils/haptics';
import { formatHeight } from '@/utils/units';

/** The big photo is a card of this shape, as wide as the page allows. */
const PHOTO_RATIO = 336 / 385;
const PHOTO_RADIUS = 28;
/** The small photos under the answers, three to a row. */
const THUMB_RATIO = 106 / 134;
/** A quick load shows nothing instead of blocks that blink. */
const SKELETON_DELAY_MS = 400;

/** A match's profile as it loads: undefined while on its way, null when the match is gone. */
export type MatchProfileLoad = {
  profile: MatchProfile | null | undefined;
  failed: boolean;
  /** It has been loading long enough to show placeholders. */
  slow: boolean;
  retry: () => void;
};

/** Loads the profile of the person you matched with, once per match. */
export function useMatchProfile(matchId: string): MatchProfileLoad {
  const [profile, setProfile] = useState<MatchProfile | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
    api.getMatchProfile(matchId).then(
      (found) => {
        if (!active) return;
        clearTimeout(timer);
        setProfile(found);
      },
      () => {
        if (!active) return;
        clearTimeout(timer);
        setFailed(true);
      },
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [matchId, attempt]);

  return {
    profile,
    failed,
    slow,
    retry() {
      setFailed(false);
      setAttempt((count) => count + 1);
    },
  };
}

type MatchProfileViewProps = {
  load: MatchProfileLoad;
  /** Their name from the match, for the texts shown before the profile has loaded. */
  name: string;
  /** "Plan a date": back to the chat, with the date ideas out. */
  onPlanDate: () => void;
};

/**
 * The Profile side of a match: all their photos, who they are, what was said
 * in the room you matched in, and a way back to the chat to plan a date.
 */
export function MatchProfileView({ load, name, onPlanDate }: MatchProfileViewProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { profile } = load;

  if (load.failed) {
    return (
      <View style={styles.centered}>
        <ErrorLine message={t('chat.profileFailed')} />
        <Button title={t('common.tryAgain')} variant="tinted" fullWidth={false} onPress={load.retry} />
      </View>
    );
  }
  if (profile === undefined) {
    return load.slow ? (
      <View style={styles.page} accessible accessibilityLabel={t('chat.profileLoading', { name })}>
        <Skeleton style={styles.photoSkeleton} />
        <Skeleton style={styles.nameSkeleton} />
        <Skeleton style={styles.lineSkeleton} />
      </View>
    ) : null;
  }
  if (profile === null) {
    return (
      <View style={styles.centered}>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {t('chat.notFound')}
        </ThemedText>
      </View>
    );
  }
  return <Loaded profile={profile} bottom={insets.bottom} onPlanDate={onPlanDate} />;
}

function Loaded({ profile, bottom, onPlanDate }: { profile: MatchProfile; bottom: number; onPlanDate: () => void }) {
  const t = useT();
  const theme = useTheme();
  const filter = useFilterText();
  const reduced = useReduceMotion();
  const { settings } = useSettings();
  const pageRef = useRef<ScrollViewInstance>(null);
  const { width: windowWidth } = useWindowDimensions();
  // Three small photos to a row, whatever the phone's width.
  const thumbWidth = Math.floor((windowWidth - 2 * Gutter - 2 * Space.xs) / 3);
  /** The photo showing in the big card. */
  const [photoIndex, setPhotoIndex] = useState(0);
  /** Set by a tap on a small photo: the big card pages there. */
  const [jump, setJump] = useState<{ to: number; id: number } | null>(null);

  const { name } = profile;
  const photos = profile.photos.length ? profile.photos : ['mock://'];
  const theyAnswered = profile.role === 'contestant';
  const rounds = profile.rounds.filter((round) => round.question);
  const job = profile.job.trim();
  const where = job && profile.city ? t('chat.profileJobIn', { job, city: profile.city }) : job || profile.city;
  const sexuality = asSexuality(profile.sexuality);
  // Only what they filled in. Their gender shows when they described it themselves.
  const about = [
    profile.heightCm ? formatHeight(profile.heightCm, settings.units) : '',
    ...cleanInterests(profile.interests).map((interest) => interestLabel(t, interest)),
    // The languages they speak share one chip.
    cleanLanguages(profile.languages)
      .map((language) => languageLabel(t, language))
      .join(', '),
    profile.genderIdentity ? identityLabel(t, identityOf(profile)) : '',
    sexuality ? sexualityLabel(t, sexuality) : '',
  ].filter(Boolean);

  function showPhoto(index: number) {
    haptics.selection();
    setJump({ to: index, id: (jump?.id ?? 0) + 1 });
    pageRef.current?.scrollTo({ y: 0, animated: !reduced });
  }

  return (
    <ScrollView
      ref={pageRef}
      style={styles.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.page, { paddingBottom: Math.max(bottom, Space.md) + Space.lg }]}>
      <Rise index={0}>
        <PhotoCard
          photos={photos}
          name={name}
          index={photoIndex}
          onIndex={setPhotoIndex}
          jump={jump}
          caption={t('chat.profilePhotoOf', { position: photoIndex + 1, count: photos.length })}
          label={(position) => t('chat.profilePhotoLabel', { name, position, count: photos.length })}
        />
      </Rise>

      <Rise index={1} style={styles.intro}>
        <ThemedText type="title" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {t('common.nameAge', { name, age: profile.age })}
        </ThemedText>
        {where ? (
          <ThemedText type="callout" themeColor="textSecondary">
            {where}
          </ThemedText>
        ) : null}
      </Rise>

      {profile.bio.trim() ? (
        <Rise index={2}>
          <ThemedText type="quote">{`“${filter(profile.bio.trim())}”`}</ThemedText>
        </Rise>
      ) : null}

      {rounds.length > 0 ? (
        <Rise index={3} style={styles.section}>
          <SectionLabel>
            {t(theyAnswered ? 'chat.profileSaid' : 'chat.profileAsked', { name })}
          </SectionLabel>
          {rounds.map((round) => (
            <View key={round.round} style={styles.round}>
              <View style={styles.question}>
                <ThemedText style={[styles.roundLabel, { color: theme.textTertiary }]}>
                  {t('chat.profileRound', { round: round.round })}
                </ThemedText>
                <ThemedText type="questionRow" style={styles.questionText}>
                  {round.question}
                </ThemedText>
              </View>
              {round.answer ? (
                <View
                  accessible
                  accessibilityLabel={`${theyAnswered ? name : t('common.you')}: ${theyAnswered ? filter(round.answer) : round.answer}`}
                  style={[styles.answer, { backgroundColor: theme.field, borderColor: theme.border }]}>
                  {theyAnswered ? null : (
                    <ThemedText type="caption" themeColor="textTertiary">
                      {t('chat.profileYouSaid')}
                    </ThemedText>
                  )}
                  <ThemedText type="callout">
                    {`“${theyAnswered ? filter(round.answer) : round.answer}”`}
                  </ThemedText>
                </View>
              ) : null}
              {round.round === profile.wonInRound ? (
                <ThemedText type="caption" style={[styles.won, { color: theme.brand }]}>
                  {t('chat.profileWon')}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </Rise>
      ) : null}

      {photos.length > 1 ? (
        <Rise index={4} style={styles.section}>
          <SectionLabel>{t('chat.profileMorePhotos')}</SectionLabel>
          <View style={styles.thumbs}>
            {photos.slice(1).map((uri, i) => (
              <PressableScale
                key={`${uri}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={t('chat.profilePhotoLabel', { name, position: i + 2, count: photos.length })}
                onPress={() => showPhoto(i + 1)}
                style={[
                  styles.thumb,
                  { width: thumbWidth, height: Math.round(thumbWidth / THUMB_RATIO), backgroundColor: theme.surface },
                ]}>
                <Photo uri={uri} name={name} hairline={false} style={StyleSheet.absoluteFill} />
                <ThemedText style={styles.thumbNumber}>{String(i + 2)}</ThemedText>
              </PressableScale>
            ))}
          </View>
        </Rise>
      ) : null}

      {about.length > 0 ? (
        <Rise index={5} style={styles.section}>
          <SectionLabel>{t('chat.profileAbout', { name })}</SectionLabel>
          <View style={styles.facts}>
            {about.map((fact) => (
              <View key={fact} style={[styles.fact, { borderColor: theme.borderStrong, backgroundColor: theme.page }]}>
                <ThemedText type="label">{fact}</ThemedText>
              </View>
            ))}
          </View>
        </Rise>
      ) : null}

      <Rise index={6}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('chat.planDate')}
          onPress={onPlanDate}
          style={[styles.plan, { backgroundColor: theme.brandWash }]}>
          <ThemedText type="task" style={{ color: theme.brand }}>
            {t('chat.planDate')}
          </ThemedText>
        </PressableScale>
      </Rise>
    </ScrollView>
  );
}

/** A section's name: small capitals over what it holds. */
function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <ThemedText accessibilityRole="header" style={[styles.sectionLabel, { color: theme.textTertiary }]}>
      {children}
    </ThemedText>
  );
}

type PhotoCardProps = {
  photos: string[];
  name: string;
  index: number;
  onIndex: (index: number) => void;
  /** A photo to page to, from outside. A new `id` means go again. */
  jump: { to: number; id: number } | null;
  /** "Photo 1 of 4". */
  caption: string;
  label: (position: number) => string;
};

/** Their photos in one card: swipe sideways, or tap its right or left half, to move through them. */
function PhotoCard({ photos, name, index, onIndex, jump, caption, label }: PhotoCardProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const ref = useRef<ScrollViewInstance>(null);
  const card = useRef<ViewInstance>(null);
  const [width, setWidth] = useState(0);
  /** Where the card starts on the screen, to tell a tap's half on the web too. */
  const left = useRef(0);

  useEffect(() => {
    if (jump && width > 0) ref.current?.scrollTo({ x: jump.to * width, animated: !reduced });
    // Only a new jump pages the card; a resize or the motion setting doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width === 0) return;
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    const next = Math.min(photos.length - 1, Math.max(0, page));
    if (next !== index) onIndex(next);
  }
  function step(by: number) {
    const next = index + by;
    if (next < 0 || next >= photos.length) return;
    haptics.selection();
    ref.current?.scrollTo({ x: next * width, animated: !reduced });
  }

  return (
    <View
      ref={card}
      style={[styles.photoCard, { backgroundColor: theme.surface }]}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
        card.current?.measureInWindow((x) => {
          left.current = x;
        });
      }}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={StyleSheet.absoluteFill}>
        {photos.map((uri, i) => (
          <Pressable
            key={`${uri}-${i}`}
            accessibilityRole="image"
            accessibilityLabel={label(i + 1)}
            // pageX, not locationX: the web reports no locationX.
            onPress={(event) => step(event.nativeEvent.pageX - left.current > width / 2 ? 1 : -1)}
            style={[styles.photoPage, { width }]}>
            <Photo uri={uri} name={name} hairline={false} style={StyleSheet.absoluteFill} />
          </Pressable>
        ))}
      </ScrollView>
      {/* Touches fall through to the photos, so a swipe over the caption still pages them. */}
      <View style={styles.photoFoot} pointerEvents="none">
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="matchPhotoScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Velvet.deep} stopOpacity={0} />
              <Stop offset="1" stopColor={Velvet.deep} stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#matchPhotoScrim)" />
        </Svg>
        <ThemedText style={styles.photoCaption}>{caption}</ThemedText>
        {photos.length > 1 ? (
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={[styles.dot, i === index ? styles.dotActive : styles.dotRest]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  page: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xs,
    gap: Space.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
  },
  centeredText: {
    textAlign: 'center',
  },
  photoSkeleton: {
    aspectRatio: PHOTO_RATIO,
    borderRadius: PHOTO_RADIUS,
  },
  nameSkeleton: {
    width: 180,
    height: 40,
    borderRadius: Radius.md,
  },
  lineSkeleton: {
    width: 220,
    height: 18,
    borderRadius: Radius.sm,
  },
  photoCard: {
    aspectRatio: PHOTO_RATIO,
    borderRadius: PHOTO_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photoPage: {
    height: '100%',
    overflow: 'hidden',
  },
  photoFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  photoCaption: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 600,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: Velvet.cream,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    height: 3,
    borderRadius: 2,
  },
  dotActive: {
    width: 18,
    backgroundColor: Velvet.cream,
  },
  dotRest: {
    width: 5,
    backgroundColor: PhotoGlass.dot,
  },
  intro: {
    gap: 6,
  },
  section: {
    gap: Space.sm,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  round: {
    gap: Space.xs,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.xs,
  },
  roundLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  questionText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
  },
  answer: {
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  won: {
    paddingHorizontal: 2,
  },
  thumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  thumb: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbNumber: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 600,
    color: Velvet.cream,
    paddingHorizontal: 10,
    paddingBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  fact: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  plan: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
});
