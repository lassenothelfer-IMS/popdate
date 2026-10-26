import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ErrorLine } from '@/components/error-line';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { MinTouch, Space } from '@/constants/theme';
import { DetailsSection, PhotoSection, useProfileForm } from '@/features/profile/profile-form';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

/** How long the "Saved" toast shows before the screen closes. */
const SAVED_PAUSE = 900;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/**
 * Edit profile (P01): Cancel, the title and Save in a bar at the top, then the
 * same photos and details as setup, prefilled and saved in place.
 */
export function EditProfileScreen() {
  const t = useT();
  const theme = useTheme();
  const { profile, saveProfile } = useSession();
  const { show, toast } = useToast();
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
  const canSave = details !== null && changed && !saving && !saved;
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
      show(t('common.saved'));
    } catch {
      const message = t('profile.saveFailed');
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Screen scroll>
        <Rise index={0} style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={goBack}
            hitSlop={8}
            style={({ pressed }) => [styles.barButton, pressed && styles.pressed]}>
            <ThemedText type="label">{t('common.cancel')}</ThemedText>
          </Pressable>
          <ThemedText type="headline" accessibilityRole="header">
            {t('settings.editProfile')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityHint={canSave ? undefined : (missing ?? t('profile.noChanges'))}
            accessibilityState={{ disabled: !canSave, busy: saving }}
            disabled={!canSave}
            onPress={handleSave}
            hitSlop={8}
            style={({ pressed }) => [styles.barButton, styles.save, pressed && styles.pressed]}>
            {saving ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <ThemedText type="headline" themeColor={canSave ? 'accentText' : 'textTertiary'}>
                {t('common.save')}
              </ThemedText>
            )}
          </Pressable>
        </Rise>

        {error ? (
          <View style={styles.note}>
            <ErrorLine message={error} />
          </View>
        ) : missing ? (
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.note}>
            {missing}
          </ThemedText>
        ) : null}

        <Rise index={1}>
          <PhotoSection form={form} style={styles.photosSection} />
        </Rise>
        <Rise index={2}>
          <DetailsSection form={form} style={styles.aboutSection} />
          <ThemedText type="caption" themeColor="textTertiary" style={styles.locked}>
            {t('settings.editLocked')}
          </ThemedText>
        </Rise>
      </Screen>
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MinTouch,
  },
  barButton: {
    minHeight: MinTouch,
    minWidth: MinTouch,
    justifyContent: 'center',
  },
  save: {
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.6,
  },
  note: {
    marginTop: Space.xs,
  },
  photosSection: {
    marginTop: Space.md,
  },
  aboutSection: {
    marginTop: Space.lg,
  },
  locked: {
    marginTop: 14,
  },
});
