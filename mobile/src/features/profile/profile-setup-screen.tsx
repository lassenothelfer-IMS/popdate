import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { api, type Profile } from '@/api';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Photo } from '@/components/photo';
import { ProgressSegments } from '@/components/progress-segments';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Toggle } from '@/components/toggle';
import { Wordmark } from '@/components/wordmark';
import { BrandBalloon, Colors, Fonts, PhotoGlass, Radius, Space, Velvet } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { GenderSection } from '@/features/profile/gender-section';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import {
  DetailsSection,
  PHOTO_COUNT,
  PhotoSection,
  useProfileForm,
} from '@/features/profile/profile-form';
import { testPhotos } from '@/features/profile/test-profile';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { ageFromBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';
import { enablePush, getPushPermission } from '@/utils/push';

/**
 * The profile, after onboarding's questions: photos (S12, S13), a few lines
 * about you (S14), saved there; then notifications (S16) when the phone hasn't
 * been asked yet, and "You're in" (S18).
 */
type Phase = 'photos' | 'about' | 'notify' | 'ready';

/** Where each phase sits on the setup's progress bar (onboarding has steps 1 to 4). */
const STEP: Record<'photos' | 'about' | 'notify', number> = { photos: 5, about: 6, notify: 7 };

export function ProfileSetupScreen() {
  const t = useT();
  const { onboarding, saveProfile } = useSession();
  const form = useProfileForm(null);
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
      // Ask about notifications only while the phone hasn't been asked (never on the web).
      const permission = await getPushPermission().catch(() => 'denied' as const);
      setPhase(permission === 'undetermined' ? 'notify' : 'ready');
    } catch {
      const message = t('profile.saveFailed');
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
      <AboutStep
        form={form}
        saving={saving}
        error={error}
        onBack={() => setPhase('photos')}
        onSave={handleSave}
      />
    );
  }
  if (phase === 'notify') return <NotifyStep onDone={() => setPhase('ready')} />;
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
  const left = PHOTO_COUNT - form.photos.length;
  const full = left === 0;
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          <Button
            title={full ? t('common.continue') : t('profile.addToContinue', { count: left })}
            disabled={!full}
            onPress={() => {
              haptics.light();
              onContinue();
            }}
          />
          {__DEV__ && !full ? (
            <Button
              title={t('profile.useTestPhotos')}
              variant="ghost"
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

type AboutStepProps = {
  form: Form;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
};

/** S14: a few lines about you. Saving here makes the profile. */
function AboutStep({ form, saving, error, onBack, onSave }: AboutStepProps) {
  const t = useT();
  const missing = form.missing('start');
  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <>
          {error ? (
            <ErrorLine message={error} />
          ) : missing ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.footerNote}>
              {missing}
            </ThemedText>
          ) : null}
          <Button
            title={t('profile.startPlaying')}
            disabled={!form.complete}
            loading={saving}
            onPress={onSave}
            accessibilityHint={form.complete ? undefined : (missing ?? undefined)}
          />
        </>
      }>
      <StepTop step={STEP.about} onBack={onBack} />
      <StepHeading title={t('profile.aboutTitle')} intro={t('profile.aboutIntro')} />
      <Rise index={2} style={styles.body}>
        <DetailsSection form={form} bare />
        <GenderSection form={form} style={styles.genderSection} />
      </Rise>
    </Screen>
  );
}

/** S16: a room waits one minute, so ask for notifications, with what they'll be. */
function NotifyStep({ onDone }: { onDone: () => void }) {
  const t = useT();
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [asking, setAsking] = useState(false);
  const rows = [
    { key: 'roomLive', title: t('onboarding.notifyRoom'), note: t('onboarding.notifyRoomNote') },
    { key: 'newMatch', title: t('onboarding.notifyMatch'), note: t('onboarding.notifyMatchNote') },
    { key: 'messages', title: t('onboarding.notifyMessages'), note: t('onboarding.notifyMessagesNote') },
  ] as const;

  async function turnOn() {
    haptics.light();
    setAsking(true);
    await enablePush().catch(() => null);
    setAsking(false);
    onDone();
  }

  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          <Button title={t('onboarding.turnOn')} loading={asking} onPress={turnOn} />
          <Button title={t('common.notNow')} variant="ghost" onPress={onDone} />
        </View>
      }>
      <StepTop step={STEP.notify} />
      <StepHeading title={t('onboarding.notifyTitle')} intro={t('onboarding.notifyBody')} />
      <Rise index={2} style={styles.body}>
        {/* What a notification looks like: decorative, the rows below say what's sent. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.preview, { backgroundColor: theme.field, borderColor: theme.border }]}>
          <View style={[styles.appIcon, { backgroundColor: theme.inverse }]}>
            <Balloon color={BrandBalloon.color} size={10} string={false} />
          </View>
          <View style={styles.previewText}>
            <View style={styles.previewTop}>
              <ThemedText type="headline" style={styles.previewApp}>
                Popdate
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                {t('onboarding.notifyNow')}
              </ThemedText>
            </View>
            <ThemedText type="callout" style={styles.previewBody}>
              {t('onboarding.notifyPreview')}
            </ThemedText>
          </View>
        </View>
        <View>
          {rows.map((row, i) => (
            <View
              key={row.key}
              style={[
                styles.notifyRow,
                i < rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}>
              <View style={styles.notifyText}>
                <ThemedText type="row" style={styles.notifyTitle}>
                  {row.title}
                </ThemedText>
                <ThemedText type="footnote" themeColor="textSecondary">
                  {row.note}
                </ThemedText>
              </View>
              <Toggle
                compact
                accessibilityLabel={row.title}
                value={settings.notifications[row.key]}
                onValueChange={(value) =>
                  void update({ notifications: { ...settings.notifications, [row.key]: value } })
                }
              />
            </View>
          ))}
        </View>
      </Rise>
    </Screen>
  );
}

/** S18: you're in. Your profile as the room sees it, then the next room. */
function ReadyStep({ profile }: { profile: Profile }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const age = ageFromBirthDate(profile.birthDate);

  async function join() {
    haptics.light();
    setJoining(true);
    setError(null);
    try {
      await api.joinQueue();
      // Home underneath, so leaving the queue lands there.
      router.replace('/home');
      router.push('/queue');
    } catch {
      setError(t('onboarding.joinFailed'));
      setJoining(false);
    }
  }

  return (
    <Screen
      scroll
      footerStyle="plain"
      footer={
        <View style={styles.actions}>
          {error ? <ErrorLine message={error} /> : null}
          <Button title={t('onboarding.joinNext')} variant="coral" loading={joining} onPress={join} />
          <Button
            title={t('onboarding.editFirst')}
            variant="ghost"
            onPress={() => {
              router.replace('/home');
              router.push('/profile');
            }}
          />
        </View>
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
            <Text style={styles.cardTagText}>{t('onboarding.photoTag', { position: 1 })}</Text>
          </View>
          <View style={[styles.cardInfo, { backgroundColor: INFO_GLASS }]}>
            <View style={styles.cardName}>
              <Balloon color={BrandBalloon.color} size={10} string={false} />
              <Text style={styles.cardNameText}>
                {t('common.nameAge', { name: profile.name, age })}
                <Text style={styles.cardCity}>{`  ${profile.city}`}</Text>
              </Text>
            </View>
            <Text style={styles.cardBio} numberOfLines={3}>
              {profile.bio}
            </Text>
          </View>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.count, { backgroundColor: theme.field, borderColor: theme.border }]}>
          <Text style={[styles.countNumber, { color: theme.text }]}>{PHOTO_COUNT}</Text>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.countLabel}>
            {t('onboarding.photosReady')}
          </ThemedText>
        </View>
      </Rise>
      <Rise index={3}>
        <View style={[styles.next, { backgroundColor: theme.field, borderColor: theme.border }]}>
          <ThemedText type="headline">{t('onboarding.readyRoomTitle')}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {t('onboarding.readyRoomBody', { city: profile.city })}
          </ThemedText>
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
  genderSection: {
    marginTop: Space.xs,
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
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: 600,
    color: Velvet.cream,
  },
  cardCity: {
    fontWeight: 400,
    color: Colors.dark.textSecondary,
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
