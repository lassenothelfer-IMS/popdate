import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type MatchProfile } from '@/api';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Photo } from '@/components/photo';
import { Prompt } from '@/components/prompt';
import { Rise } from '@/components/rise';
import { SideSwipe } from '@/components/side-swipe';
import { Skeleton } from '@/components/skeleton';
import { TextLink } from '@/components/text-link';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Space } from '@/constants/theme';
import { asSexuality, identityLabel, identityOf, sexualityLabel } from '@/features/profile/identity';
import { interestLabel, languageLabel } from '@/features/profile/tags-section';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { cleanInterests, cleanLanguages } from '@/shared/profile-tags';
import { useFilterText, useSettings } from '@/state/settings';
import { formatHeight } from '@/utils/units';

/** Every photo is a tall card as wide as the page. */
const PHOTO_RATIO = 0.8;
const PHOTO_RADIUS = 24;
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
  /** A swipe to the right under the photos: back to the chat. */
  onSwipeBack: () => void;
};

/**
 * The Profile side of a match: all their photos, who they are, what was said
 * in the room you matched in, and a way back to the chat to plan a date.
 */
export function MatchProfileView({ load, name, onPlanDate, onSwipeBack }: MatchProfileViewProps) {
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
  return <Loaded profile={profile} bottom={insets.bottom} onPlanDate={onPlanDate} onSwipeBack={onSwipeBack} />;
}

/**
 * Their profile, in the order you get to know someone: a photo, who they are,
 * another photo, something they said in your room, and on like that until the
 * photos and the answers run out. A swipe to the right goes back to the chat.
 */
function Loaded({
  profile,
  bottom,
  onPlanDate,
  onSwipeBack,
}: {
  profile: MatchProfile;
  bottom: number;
  onPlanDate: () => void;
  onSwipeBack: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const filter = useFilterText();
  const { settings } = useSettings();

  const { name } = profile;
  const photos = profile.photos.length ? profile.photos : ['mock://'];
  const theyAnswered = profile.role === 'contestant';
  const rounds = profile.rounds.filter((round) => round.question && round.answer);
  const job = profile.job.trim();
  const sexuality = asSexuality(profile.sexuality);
  // Who they are, one fact to a line. Only what they filled in.
  const facts = [
    job,
    profile.city,
    profile.heightCm ? formatHeight(profile.heightCm, settings.units) : '',
    profile.genderIdentity ? identityLabel(t, identityOf(profile)) : '',
    sexuality ? sexualityLabel(t, sexuality) : '',
    cleanInterests(profile.interests)
      .map((interest) => interestLabel(t, interest))
      .join(', '),
    cleanLanguages(profile.languages)
      .map((language) => languageLabel(t, language))
      .join(', '),
  ].filter(Boolean);

  // After the first photo and the facts: a photo, then an answer, for as long as either lasts.
  const later = photos.slice(1);
  const turns = Math.max(later.length, rounds.length);

  function photo(uri: string, position: number) {
    return (
      <View style={[styles.photo, { backgroundColor: theme.surface }]}>
        <Photo
          uri={uri}
          name={name}
          hairline={false}
          accessibilityLabel={t('chat.profilePhotoLabel', { name, position, count: photos.length })}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Math.max(bottom, Space.md) + Space.lg }}>
      <SideSwipe onRight={onSwipeBack} fill={false} style={styles.page}>
        <Rise index={0}>{photo(photos[0], 1)}</Rise>

        <Rise index={1} style={styles.who}>
          <ThemedText type="title" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('common.nameAge', { name, age: profile.age })}
          </ThemedText>
          {profile.bio.trim() ? <ThemedText type="quote">{`“${filter(profile.bio.trim())}”`}</ThemedText> : null}
          {facts.length > 0 ? (
            <View>
              {facts.map((fact, index) => (
                <View
                  key={fact}
                  style={[styles.fact, { borderTopColor: theme.border }, index === 0 && styles.firstFact]}>
                  <ThemedText type="body">{fact}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Rise>

        {Array.from({ length: turns }, (_, index) => {
          const round = rounds[index];
          return (
            <View key={index} style={styles.turn}>
              {later[index] ? photo(later[index], index + 2) : null}
              {round ? (
                <View style={styles.said}>
                  <Prompt
                    question={round.question}
                    answer={theyAnswered ? filter(round.answer ?? '') : (round.answer ?? '')}
                    size="large"
                  />
                  {/* When they were choosing, the answers under their questions are yours. */}
                  {theyAnswered ? null : (
                    <ThemedText type="callout">{t('chat.profileYouSaid')}</ThemedText>
                  )}
                  {round.round === profile.wonInRound ? (
                    <ThemedText type="headline" style={{ color: theme.brand }}>
                      {t('chat.profileWon')}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        <TextLink title={t('chat.planDate')} onPress={onPlanDate} />
      </SideSwipe>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  page: {
    paddingHorizontal: Gutter,
    paddingTop: Space.sm,
    gap: Space.xl,
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
  photo: {
    aspectRatio: PHOTO_RATIO,
    borderRadius: PHOTO_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  who: {
    gap: Space.md,
  },
  // One fact to a line, a hairline between them.
  fact: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  firstFact: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  turn: {
    gap: Space.xl,
  },
  // What they said gets room: it is the other half of the profile.
  said: {
    gap: Space.sm,
    paddingVertical: Space.md,
  },
});
