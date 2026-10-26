import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { ProgressSegments } from '@/components/progress-segments';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { SETUP_STEPS } from '@/features/onboarding/setup-steps';
import {
  DetailsSection,
  PHOTO_COUNT,
  PhotoSection,
  useProfileForm,
} from '@/features/profile/profile-form';
import { testPhotos } from '@/features/profile/test-profile';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

export function ProfileSetupScreen() {
  const t = useT();
  const { onboarding, saveProfile } = useSession();
  const form = useProfileForm(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!onboarding) return <Redirect href="/onboarding" />;

  const { complete, details } = form;
  const missing = form.missing('start');
  const showTestPhotos = __DEV__ && form.photos.length < PHOTO_COUNT;

  async function handleSave() {
    if (!details) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile(details);
      // Home underneath, and How to play over it, once, before the first game.
      router.replace('/home');
      router.push('/how-to-play');
    } catch {
      const message = t('profile.saveFailed');
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
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
            disabled={!complete}
            loading={saving}
            onPress={handleSave}
            accessibilityHint={complete ? undefined : (missing ?? undefined)}
          />
        </>
      }>
      <View style={styles.segments}>
        <ProgressSegments
          total={SETUP_STEPS}
          filled={SETUP_STEPS}
          accessibilityLabel={t('profile.step', { step: SETUP_STEPS, total: SETUP_STEPS })}
        />
      </View>

      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('profile.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.intro}>
        {t('profile.intro')}
      </ThemedText>

      <PhotoSection form={form} style={styles.photosSection} />
      {showTestPhotos ? (
        <View style={styles.testPhotos}>
          <Button
            title={t('profile.useTestPhotos')}
            variant="ghost"
            onPress={() => form.setPhotos(testPhotos())}
          />
        </View>
      ) : null}

      <DetailsSection
        form={form}
        style={[styles.aboutSection, showTestPhotos && styles.aboutAfterTestPhotos]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    paddingTop: 4,
  },
  title: {
    marginTop: 28,
  },
  intro: {
    marginTop: 10,
  },
  photosSection: {
    marginTop: 24,
  },
  testPhotos: {
    marginTop: 6,
  },
  aboutSection: {
    marginTop: 24,
  },
  aboutAfterTestPhotos: {
    marginTop: 18,
  },
  footerNote: {
    textAlign: 'center',
  },
});
