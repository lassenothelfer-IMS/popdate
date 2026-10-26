import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { DetailsSection, PhotoSection, useProfileForm } from '@/features/profile/profile-form';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

/** How long "Saved" stays on the button before the screen closes. */
const SAVED_PAUSE = 700;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/** Your profile after setup: the same photos and details, prefilled, saved in place. */
export function EditProfileScreen() {
  const t = useT();
  const theme = useTheme();
  const { profile, saveProfile } = useSession();
  const form = useProfileForm(
    profile
      ? {
          name: profile.name,
          city: profile.city,
          heightCm: profile.heightCm,
          job: profile.job,
          bio: profile.bio,
          photos: profile.photos,
        }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Saved" shows for a beat, then the screen closes. Leaving sooner cancels it.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(goBack, SAVED_PAUSE);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!profile) return <Redirect href="/" />;

  const { details, changed } = form;
  const canSave = details !== null && changed;
  const missing = details ? null : form.missing('save');

  async function handleSave() {
    if (!profile || !details) return;
    setSaving(true);
    setError(null);
    try {
      // Onboarding's answers are gone after setup; the profile still holds them.
      await saveProfile(details, {
        birthDate: profile.birthDate,
        gender: profile.gender,
        wantsToMeet: profile.wantsToMeet,
        termsAcceptedAt: profile.termsAcceptedAt,
      });
      setSaving(false);
      setSaved(true);
      haptics.success();
      AccessibilityInfo.announceForAccessibility(t('common.saved'));
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
          ) : missing && !saved ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.footerNote}>
              {missing}
            </ThemedText>
          ) : null}
          {saved ? (
            <Button
              title={t('common.saved')}
              icon={<Icon name="check" size={17} color={theme.onInverse} />}
            />
          ) : (
            <Button
              title={t('common.save')}
              disabled={!canSave}
              loading={saving}
              onPress={handleSave}
              accessibilityHint={
                canSave ? undefined : (missing ?? t('profile.noChanges'))
              }
            />
          )}
        </>
      }>
      <View style={styles.back}>
        <BackButton onPress={goBack} />
      </View>

      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('profile.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.intro}>
        {t('profile.intro')}
      </ThemedText>

      <PhotoSection form={form} style={styles.photosSection} />
      <DetailsSection form={form} style={styles.aboutSection} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    paddingTop: Space.xxs,
  },
  title: {
    marginTop: Space.md,
  },
  intro: {
    marginTop: 10,
  },
  photosSection: {
    marginTop: 24,
  },
  aboutSection: {
    marginTop: 24,
  },
  footerNote: {
    textAlign: 'center',
  },
});
