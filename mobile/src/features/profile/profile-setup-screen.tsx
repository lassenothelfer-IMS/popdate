import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import type { Profile } from '@/api';
import { MIN_PHOTOS } from '@/api/types';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Photo } from '@/components/photo';
import { ProgressSegments } from '@/components/progress-segments';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { BrandBalloon, Fonts, PhotoGlass, Radius, Space, Velvet } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { GenderSection } from '@/features/profile/gender-section';
import { TagsSection } from '@/features/profile/tags-section';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import {
  DetailsSection,
  PHOTO_COUNT,
  PhotoSection,
  saveFailedMessage,
  useProfileForm,
} from '@/features/profile/profile-form';
import { testPhotos } from '@/features/profile/test-profile';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { SETUP_DRAFT_KEY, useSession } from '@/state/session';
import { ageFromBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';

/**
 * The profile, after onboarding's questions: photos (S12, S13), a few lines
 * about you (S14), then two short pages that are yours to skip: interests and
 * languages, and gender and sexuality. The last one saves, then "You're in"
 * (S18). Small pages, because a long one gets abandoned.
 */
type Phase = 'photos' | 'about' | 'interests' | 'identity' | 'ready';

/** Where each phase sits on the setup's progress bar (onboarding has steps 1 to 4). */
const STEP: Record<Exclude<Phase, 'ready'>, number> = { photos: 5, about: 6, interests: 7, identity: 8 };

export function ProfileSetupScreen() {
  const t = useT();
  const { onboarding, saveProfile } = useSession();
  const form = useProfileForm(null, { draftKey: SETUP_DRAFT_KEY });
  const [phase, setPhase] = useState<Phase>('photos');
  const [saved, setSaved] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saving clears the onboarding answers, so only the steps before it need them.
  if (!onboarding && !saved) return <Redirect href="/onboarding" />;

  async function handleSave() {
    if (!form.details) return;
    haptics.light();
    setSaving(true);
    setError(null);
    try {
      const profile = await saveProfile(form.details);
      setSaved(profile);
      setPhase('ready');
    } catch (failure) {
      const message = saveFailedMessage(t, failure);
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setSaving(false);
    }
  }

  if (phase === 'photos') return <PhotosStep form={form} onContinue={() => setPhase('about')} />;
  if (phase === 'about') {
    return (
      <AboutStep form={form} onBack={() => setPhase('photos')} onContinue={() => setPhase('interests')} />
    );
  }
  if (phase === 'interests') {
    return (
      <InterestsStep form={form} onBack={() => setPhase('about')} onContinue={() => setPhase('identity')} />
    );
  }
  if (phase === 'identity') {
    return (
      <IdentityStep
        form={form}
        saving={saving}
        error={error}
        // Going back mid-save would leave the save's outcome on a step you can't see.
        onBack={() => {
          if (!saving) setPhase('interests');
        }}
        onSave={handleSave}
      />
    );
  }
  return saved ? <ReadyStep profile={saved} /> : null;
}

type Form = ReturnType<typeof useProfileForm>;

/** The bar and, from the second step on, Back. */
function StepTop({ step, onBack }: { step: number; onBack?: () => void }) {
  const t = useT();
  return (
    <Rise index={0}>
      <View style={styles.progress}>
        <ProgressSegments
          total={SETUP_STEPS}
          filled={step}
          gap={4}
          accessibilityLabel={setupStepLabel(step, t)}
        />
      </View>
      {onBack ? <BackButton onPress={onBack} /> : <View style={styles.noBack} />}
    </Rise>
  );
}

/** A step's title and the line under it. */
function StepHeading({ title, intro }: { title: string; intro: string }) {
  return (
    <Rise index={1} style={styles.heading}>
      <ThemedText type="display" accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary">
        {intro}
      </ThemedText>
    </Rise>
  );
}

/** S12 and S13: six photos, one per round, the lead two by two. */
function PhotosStep({ form, onContinue }: { form: Form; onContinue: () => void }) {
  const t = useT();
  const theme = useTheme();
  // Four to play; the last two slots are optional.
  const left = Math.max(0, MIN_PHOTOS - form.photos.length);
  const enough = left === 0;
  const full = form.photos.length === PHOTO_COUNT;
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          <Button
            title={enough ? t('common.continue') : t('profile.addToContinue', { count: left })}
            disabled={!enough}
            onPress={() => {
              haptics.light();
              onContinue();
            }}
          />
          {__DEV__ && !enough ? (
            <Button
              title={t('profile.useTestPhotos')}
              variant="plain"
              onPress={() => form.setPhotos(testPhotos())}
            />
          ) : null}
        </View>
      }>
      <StepTop step={STEP.photos} />
      <StepHeading
        title={t('profile.photosTitle')}
        intro={full ? t('profile.photosIntroFull') : t('profile.photosIntro')}
      />
      <Rise index={2} style={styles.body}>
        <PhotoSection form={form} bare />
        {full ? (
          <View style={styles.done} accessibilityLiveRegion="polite">
            <Icon name="checkCircle" size={16} color={theme.success} />
            <ThemedText type="callout" themeColor="success" style={styles.doneText}>
              {t('profile.photosDone', { count: PHOTO_COUNT })}
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.tips, { backgroundColor: theme.field, borderColor: theme.border }]}>
            <ThemedText type="headline" style={styles.tipsTitle}>
              {t('profile.whatWorks')}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.tipsBody}>
              {t('profile.whatWorksBody')}
            </ThemedText>
          </View>
        )}
      </Rise>
    </Screen>
  );
}

type StepProps = { form: Form; onBack: () => void; onContinue: () => void };

/** S14: a few lines about you. Your name and city are the only things setup insists on here. */
function AboutStep({ form, onBack, onContinue }: StepProps) {
  const t = useT();
  const missing = form.missing('start');
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <>
          {missing ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.footerNote}>
              {missing}
            </ThemedText>
          ) : null}
          <Button
            title={t('common.continue')}
            disabled={!form.complete}
            onPress={() => {
              haptics.light();
              onContinue();
            }}
            accessibilityHint={form.complete ? undefined : (missing ?? undefined)}
          />
        </>
      }>
      <StepTop step={STEP.about} onBack={onBack} />
      <StepHeading title={t('profile.aboutTitle')} intro={t('profile.aboutIntro')} />
      <Rise index={2} style={styles.body}>
        <DetailsSection form={form} bare />
      </Rise>
    </Screen>
  );
}

/** What you like and the languages you speak. All optional: with nothing picked, the button skips. */
function InterestsStep({ form, onBack, onContinue }: StepProps) {
  const t = useT();
  const picked = form.interests.length + form.languages.length > 0;
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <Button
          title={picked ? t('common.continue') : t('profile.skipStep')}
          variant={picked ? 'prominent' : 'tinted'}
          onPress={() => {
            haptics.light();
            onContinue();
          }}
        />
      }>
      <StepTop step={STEP.interests} onBack={onBack} />
      <StepHeading title={t('profile.interestsTitle')} intro={t('profile.interestsIntro')} />
      <Rise index={2} style={styles.body}>
        <TagsSection form={form} />
      </Rise>
    </Screen>
  );
}

type IdentityStepProps = {
  form: Form;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
};

/** Your gender in your own words and your sexuality, both optional. Saving here makes the profile. */
function IdentityStep({ form, saving, error, onBack, onSave }: IdentityStepProps) {
  const t = useT();
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <>
          {error ? <ErrorLine message={error} /> : null}
          <Button
            title={t('profile.startPlaying')}
            disabled={!form.complete}
            loading={saving}
            onPress={onSave}
          />
        </>
      }>
      <StepTop step={STEP.identity} onBack={onBack} />
      <StepHeading title={t('profile.genderAndSexuality')} intro={t('profile.identityIntro')} />
      <Rise index={2} style={styles.body}>
        <GenderSection form={form} bare />
      </Rise>
    </Screen>
  );
}

/** S18: you're in. Your profile as the room sees it, then on to Home. */
function ReadyStep({ profile }: { profile: Profile }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const age = ageFromBirthDate(profile.birthDate);

  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <Button
          title={t('common.continue')}
          onPress={() => {
            haptics.light();
            router.replace('/home');
          }}
        />
      }>
      <Rise index={0}>
        <Wordmark />
      </Rise>
      <Rise index={1} style={styles.readyHeading}>
        <ThemedText type="kicker">{t('onboarding.readyKicker')}</ThemedText>
        <ThemedText type="title" accessibilityRole="header">
          {t('onboarding.readyTitle', { name: profile.name })}
        </ThemedText>
      </Rise>
      <Rise index={2} style={styles.stage}>
        <View
          accessible
          accessibilityLabel={t('onboarding.readyCardLabel', {
            name: profile.name,
            age,
            city: profile.city,
            bio: profile.bio,
          })}
          style={[styles.card, { borderColor: theme.border }]}>
          <Photo
            uri={profile.photos[0]}
            name={profile.name}
            tone={youSeat(seats)}
            initialSize={120}
            hairline={false}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.cardTag, { backgroundColor: TAG_GLASS }]}>
            <Text style={styles.cardTagText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
              {t('onboarding.photoTag', { position: 1 })}
            </Text>
          </View>
          <View style={[styles.cardInfo, { backgroundColor: INFO_GLASS }]}>
            <View style={styles.cardName}>
              <Balloon color={BrandBalloon.color} size={10} />
              {/* The card keeps its size: its text grows a little with Dynamic Type, then stops. */}
              <Text style={styles.cardNameText} maxFontSizeMultiplier={1.3} numberOfLines={2}>
                {t('common.nameAge', { name: profile.name, age })}
                <Text style={styles.cardCity}>{`  ${profile.city}`}</Text>
              </Text>
            </View>
            {/* The bio is optional: without one, the panel is just your name. */}
            {profile.bio ? (
              <Text style={styles.cardBio} maxFontSizeMultiplier={1.3} numberOfLines={3}>
                {profile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      </Rise>
    </Screen>
  );
}

/** The photo tag's dark glass and the info panel's, the same on any photo in both themes. */
const TAG_GLASS = PhotoGlass.tag;
const INFO_GLASS = PhotoGlass.info;

const styles = StyleSheet.create({
  progress: {
    paddingTop: Space.xxs,
    paddingBottom: Space.xxs,
  },
  noBack: {
    height: 44,
  },
  heading: {
    marginTop: 26,
    gap: 10,
  },
  body: {
    marginTop: 20,
    gap: 20,
  },
  actions: {
    gap: 6,
  },
  footerNote: {
    textAlign: 'center',
  },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  doneText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
  },
  tips: {
    gap: Space.xs,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  tipsTitle: {
    fontSize: 14,
  },
  tipsBody: {
    fontSize: 14,
    lineHeight: 19,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: 18,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  previewApp: {
    fontSize: 14,
  },
  previewBody: {
    fontSize: 14,
    lineHeight: 18,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingVertical: 14,
  },
  notifyText: {
    flex: 1,
    gap: 2,
  },
  notifyTitle: {
    fontSize: 16,
  },
  readyHeading: {
    marginTop: 40,
    gap: 10,
  },
  // The photo card stands right of center; the count card leans on its left edge,
  // above the name panel so it never covers your name.
  stage: {
    marginTop: 28,
    height: 364,
  },
  card: {
    position: 'absolute',
    left: 60,
    top: 0,
    width: 260,
    height: 340,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.8)',
  },
  cardTag: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  cardTagText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: 600,
    color: Velvet.cream,
  },
  cardInfo: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  cardName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  cardNameText: {
    flexShrink: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: 600,
    color: Velvet.cream,
  },
  cardCity: {
    fontWeight: 400,
    color: Velvet.faint,
  },
  cardBio: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 20,
    color: Velvet.cream,
  },
  count: {
    position: 'absolute',
    left: 0,
    top: 92,
    width: 120,
    height: 120,
    paddingHorizontal: Space.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transform: [{ rotate: '-6deg' }],
  },
  countNumber: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontSize: 34,
    lineHeight: 36,
  },
  countLabel: {
    textAlign: 'center',
  },
  next: {
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
