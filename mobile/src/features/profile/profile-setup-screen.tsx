import { Redirect, router, type Href } from 'expo-router';
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
import { useJoinQueue } from '@/features/home/use-join-queue';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import {
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
 * After onboarding's questions: your photos, the house rules, then "You're in"
 * and straight to a room. Everything else on a profile (city, job, a bio,
 * interests, languages, sexuality) waits until after the first game, when the
 * You tab asks for it: before then nobody knows yet why it's worth writing.
 */
type Phase = 'photos' | 'rules' | 'ready';

/** Where each phase sits on the setup's progress bar (onboarding has steps 1 to 4). */
const STEP: Record<Exclude<Phase, 'ready'>, number> = { photos: 5, rules: 6 };

/** The four house rules: a title and a line each (translation keys). */
const RULES = ([1, 2, 3, 4] as const).map((n) => ({
  title: `onboarding.rule${n}Title` as const,
  body: `onboarding.rule${n}Body` as const,
}));

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

  /** Agreeing to the house rules makes the profile: your name, photos and onboarding's answers. */
  async function handleAgree() {
    if (!onboarding?.firstName || form.photos.length < MIN_PHOTOS) return;
    haptics.light();
    setSaving(true);
    setError(null);
    try {
      const profile = await saveProfile(
        {
          name: onboarding.firstName,
          city: '',
          heightCm: null,
          job: '',
          bio: '',
          interests: [],
          languages: [],
          photos: form.photos,
        },
        { ...onboarding, termsAcceptedAt: new Date().toISOString() },
      );
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

  if (phase === 'photos') return <PhotosStep form={form} onContinue={() => setPhase('rules')} />;
  if (phase === 'rules') {
    return (
      <RulesStep
        saving={saving}
        error={error}
        // Going back mid-save would leave the save's outcome on a step you can't see.
        onBack={() => {
          if (!saving) setPhase('photos');
        }}
        onAgree={() => void handleAgree()}
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
      <ThemedText type="body">{intro}</ThemedText>
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
          <View style={styles.tips}>
            <ThemedText type="headline">{t('profile.whatWorks')}</ThemedText>
            <ThemedText type="body">{t('profile.whatWorksBody')}</ThemedText>
          </View>
        )}
      </Rise>
    </Screen>
  );
}

type RulesStepProps = {
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onAgree: () => void;
};

/**
 * The house rules, just before you play: each one lands in turn, large, on the
 * page. "I'm in" agrees to them and to the terms, which the line above it says
 * in full, at the size of everything else.
 */
function RulesStep({ saving, error, onBack, onAgree }: RulesStepProps) {
  const t = useT();
  const theme = useTheme();
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          {error ? <ErrorLine message={error} /> : null}
          <ThemedText type="callout" style={styles.agreeLine}>
            {t('onboarding.agreeBefore')}
            <ThemedText
              type="callout"
              accessibilityRole="link"
              style={styles.link}
              onPress={() => router.push('/settings/terms' as Href)}>
              {t('onboarding.terms')}
            </ThemedText>
            {t('onboarding.termsAnd')}
            <ThemedText
              type="callout"
              accessibilityRole="link"
              style={styles.link}
              onPress={() => router.push('/settings/privacy' as Href)}>
              {t('onboarding.privacy')}
            </ThemedText>
            {t('onboarding.termsAfter')}
          </ThemedText>
          <Button title={t('onboarding.imIn')} loading={saving} onPress={onAgree} />
        </View>
      }>
      <StepTop step={STEP.rules} onBack={onBack} />
      <Rise index={1} style={styles.heading}>
        <ThemedText type="display" accessibilityRole="header">
          {t('onboarding.titleTerms')}
        </ThemedText>
      </Rise>
      <View style={styles.rules}>
        {RULES.map((rule, i) => (
          <Rise
            key={rule.title}
            index={i + 2}
            style={[
              styles.rule,
              i < RULES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
            ]}>
            <View accessible style={styles.ruleRow}>
              <Text style={[styles.ruleNumber, { color: theme.brand }]}>{i + 1}</Text>
              <View style={styles.ruleText}>
                <ThemedText type="task">{t(rule.title)}</ThemedText>
                <ThemedText type="body">{t(rule.body)}</ThemedText>
              </View>
            </View>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}

/** S18: you're in. Your profile as the room sees it, then on to Home. */
function ReadyStep({ profile }: { profile: Profile }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const age = ageFromBirthDate(profile.birthDate);
  const { join, joining, error } = useJoinQueue();

  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          {error ? <ErrorLine message={error} /> : null}
          {/* Straight into your first room: Home goes under the line, so leaving it lands there. */}
          <Button
            title={t('onboarding.findRoom')}
            loading={joining}
            onPress={() => void join(() => router.replace('/home'))}
          />
        </View>
      }>
      <Rise index={0}>
        <Wordmark />
      </Rise>
      <Rise index={1} style={styles.readyHeading}>
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
                {profile.city ? <Text style={styles.cardCity}>{`  ${profile.city}`}</Text> : null}
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
  // What makes a good photo, on the page: no box around it.
  tips: {
    gap: Space.xxs,
  },
  agreeLine: {
    textAlign: 'center',
    marginBottom: Space.xs,
  },
  link: {
    textDecorationLine: 'underline',
  },
  rules: {
    marginTop: Space.md,
  },
  rule: {
    paddingVertical: Space.md,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  ruleNumber: {
    width: 28,
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 32,
  },
  ruleText: {
    flex: 1,
    gap: 4,
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
