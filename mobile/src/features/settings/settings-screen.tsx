import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { api, type Settings, type VerificationStatus } from '@/api';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MinTouch, Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { languageName, regionSettingLabel } from '@/features/settings/options';
import {
  ChoiceRow,
  confirmAction,
  goBackOr,
  InfoRow,
  NavRow,
  SettingsSection,
  showNotice,
  SwitchRow,
} from '@/features/settings/settings-ui';
import { deviceRegion, useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { haptics } from '@/utils/haptics';
import { enablePush, getPushPermission, type PushPermission } from '@/utils/push';

const SUPPORT_EMAIL = 'support@popdate.app';

/** TODO(Elias): the hosted terms and privacy pages. Until then the rows say "Coming soon". */
const TERMS_URL: string | null = null;
const PRIVACY_URL: string | null = null;

type SectionKey = 'preferences' | 'notifications' | 'safety' | 'account';
type NotificationKey = keyof Settings['notifications'];

const isWeb = Platform.OS === 'web';

const STATUS_KEYS: Record<VerificationStatus, string> = {
  none: 'settings.statusNone',
  pending: 'settings.statusPending',
  verified: 'settings.statusVerified',
  rejected: 'settings.statusRejected',
};

export function SettingsScreen() {
  const t = useT();
  const { settings, update } = useSettings();
  const { signOut, deleteAccount } = useSession();
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  /** Null until read, so the switches don't flicker off and on. */
  const [permission, setPermission] = useState<PushPermission | null>(null);
  /** You tried to turn one on and the phone said no: explain how to fix it. */
  const [askedPush, setAskedPush] = useState(false);
  const [error, setError] = useState<{ section: SectionKey; message: string } | null>(null);
  const [ending, setEnding] = useState<'signOut' | 'delete' | null>(null);
  const deniedMessage =
    Platform.OS === 'ios' ? t('settings.notificationsDeniedIos') : t('settings.notificationsDenied');

  // Status, count and permission can all change on the pages this one opens.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      api.getVerification().then(
        (status) => active && setVerification(status),
        () => {},
      );
      api.listBlocked().then(
        (list) => active && setBlockedCount(list.length),
        () => {},
      );
      getPushPermission().then(
        (status) => active && setPermission(status),
        () => {},
      );
      return () => {
        active = false;
      };
    }, []),
  );

  // Coming back from iOS Settings: pick up a permission you just allowed.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPushPermission().then(setPermission, () => {});
    });
    return () => subscription.remove();
  }, []);

  function fail(section: SectionKey, message = t('common.somethingWrong')) {
    setError({ section, message });
    haptics.error();
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function save(section: SectionKey, change: Partial<Settings>) {
    setError(null);
    try {
      await update(change);
    } catch {
      fail(section);
    }
  }

  async function toggleNotification(key: NotificationKey, on: boolean) {
    setError(null);
    const wasAllowed = permission === 'granted';
    if (on) {
      const status = await enablePush();
      setPermission(status);
      if (status !== 'granted') {
        setAskedPush(true);
        AccessibilityInfo.announceForAccessibility(deniedMessage);
        return;
      }
    }
    // The switches read off until the phone allows pushes. Allowing them through one switch
    // turns on just that one, not the others that were only on by default.
    const base = wasAllowed
      ? settings.notifications
      : { roomLive: false, newMatch: false, messages: false };
    await save('notifications', { notifications: { ...base, [key]: on } });
  }

  function openLegal(url: string | null) {
    if (url) {
      Linking.openURL(url).catch(() => fail('account'));
      return;
    }
    showNotice(t('settings.comingSoon'), t('settings.comingSoonBody'));
  }

  async function contactSupport() {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch {
      // No mail app set up: give the address instead.
      showNotice(t('settings.support'), t('settings.supportNoMail', { email: SUPPORT_EMAIL }));
    }
  }

  async function handleSignOut() {
    const ok = await confirmAction({
      title: t('settings.signOutTitle'),
      message: t('settings.signOutBody'),
      confirmLabel: t('settings.signOut'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await end('signOut', signOut);
  }

  async function handleDelete() {
    const first = await confirmAction({
      title: t('settings.deleteTitle'),
      message: t('settings.deleteBody'),
      confirmLabel: t('common.continue'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!first) return;
    const second = await confirmAction({
      title: t('settings.deleteConfirmTitle'),
      message: t('settings.deleteConfirmBody'),
      confirmLabel: t('settings.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!second) return;
    await end('delete', deleteAccount);
  }

  async function end(kind: 'signOut' | 'delete', action: () => Promise<void>) {
    setError(null);
    setEnding(kind);
    try {
      await action();
      haptics.medium();
      // Onboarding starts a fresh stack, with no home left underneath to go back to.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/onboarding');
    } catch {
      setEnding(null);
      fail('account');
    }
  }

  // Off on the phone means nothing arrives, whatever the switches say.
  const pushAllowed = permission === null || permission === 'granted';
  const anyOn = Object.values(settings.notifications).some(Boolean);
  const showDenied = !isWeb && permission === 'denied' && (askedPush || anyOn);

  const verificationLabel = verification ? t(STATUS_KEYS[verification]) : undefined;
  const verificationColor =
    verification === 'verified' ? 'success' : verification === 'rejected' ? 'danger' : 'textSecondary';

  const errorFor = (section: SectionKey) =>
    error?.section === section ? <ErrorLine message={error.message} /> : null;

  const notificationRows: { key: NotificationKey; label: string }[] = [
    { key: 'roomLive', label: t('settings.notifyRoomLive') },
    { key: 'newMatch', label: t('settings.notifyNewMatch') },
    { key: 'messages', label: t('settings.notifyMessages') },
  ];

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr('/home')} />
      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('settings.title')}
      </ThemedText>

      <SettingsSection title={t('settings.account')}>
        <NavRow label={t('settings.editProfile')} onPress={() => router.push('/profile')} />
        <NavRow
          label={t('settings.verification')}
          value={verificationLabel}
          valueColor={verificationColor}
          onPress={() => router.push('/settings/verify')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.preferences')} footer={errorFor('preferences')}>
        <NavRow
          label={t('settings.language')}
          value={languageName(settings.language, t)}
          onPress={() => router.push('/settings/language')}
        />
        <NavRow
          label={t('settings.region')}
          value={regionSettingLabel(settings.region, deviceRegion(), t)}
          onPress={() => router.push('/settings/region')}
        />
        <ChoiceRow
          label={t('settings.units')}
          value={settings.units}
          options={[
            { value: 'metric', label: t('settings.unitsMetric') },
            { value: 'imperial', label: t('settings.unitsImperial') },
          ]}
          onChange={(units) => save('preferences', { units })}
        />
        <ChoiceRow
          label={t('settings.appearance')}
          value={settings.appearance}
          options={[
            { value: 'system', label: t('settings.appearanceSystem') },
            { value: 'light', label: t('settings.appearanceLight') },
            { value: 'dark', label: t('settings.appearanceDark') },
          ]}
          onChange={(appearance) => save('preferences', { appearance })}
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings.notifications')}
        footer={
          isWeb || showDenied || error?.section === 'notifications' ? (
            <>
              {isWeb ? (
                <ThemedText type="footnote" themeColor="textSecondary">
                  {t('settings.notificationsWeb')}
                </ThemedText>
              ) : null}
              {showDenied ? (
                <View style={styles.denied}>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {deniedMessage}
                  </ThemedText>
                  <View style={styles.openSettings}>
                    <Button
                      variant="secondary"
                      title={t('settings.openSettings')}
                      onPress={() => Linking.openSettings()}
                    />
                  </View>
                </View>
              ) : null}
              {errorFor('notifications')}
            </>
          ) : null
        }>
        {notificationRows.map(({ key, label }) => (
          <SwitchRow
            key={key}
            label={label}
            value={!isWeb && pushAllowed && settings.notifications[key]}
            disabled={isWeb}
            onValueChange={(on) => toggleNotification(key, on)}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={t('settings.safety')} footer={errorFor('safety')}>
        <SwitchRow
          label={t('settings.commentFilter')}
          description={t('settings.commentFilterHint')}
          value={settings.commentFilter}
          onValueChange={(commentFilter) => save('safety', { commentFilter })}
        />
        <NavRow
          label={t('settings.blocked')}
          value={
            blockedCount === null
              ? undefined
              : blockedCount === 0
                ? t('settings.blockedNone')
                : String(blockedCount)
          }
          onPress={() => router.push('/settings/blocked')}
        />
        <NavRow label={t('settings.safetyTips')} onPress={() => router.push('/settings/safety-tips')} />
      </SettingsSection>

      <SettingsSection title={t('settings.legal')}>
        <NavRow label={t('settings.terms')} onPress={() => openLegal(TERMS_URL)} />
        <NavRow label={t('settings.privacy')} onPress={() => openLegal(PRIVACY_URL)} />
        <NavRow
          label={t('settings.support')}
          value={SUPPORT_EMAIL}
          onPress={contactSupport}
          accessibilityHint={t('settings.supportHint')}
        />
        <InfoRow label={t('settings.version')} value={Constants.expoConfig?.version ?? '–'} />
      </SettingsSection>

      <View style={styles.end}>
        {errorFor('account')}
        <Button
          variant="ghost"
          title={t('settings.signOut')}
          loading={ending === 'signOut'}
          disabled={ending !== null}
          onPress={handleSignOut}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.deleteAccount')}
          accessibilityState={{ disabled: ending !== null, busy: ending === 'delete' }}
          disabled={ending !== null}
          onPress={handleDelete}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
          <ThemedText type="label" themeColor={ending === 'delete' ? 'textTertiary' : 'danger'}>
            {ending === 'delete' ? t('settings.deleting') : t('settings.deleteAccount')}
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Space.md,
  },
  denied: {
    gap: Space.sm,
  },
  openSettings: {
    alignSelf: 'flex-start',
  },
  end: {
    marginTop: Space.xl,
    gap: Space.xxs,
    alignItems: 'stretch',
  },
  delete: {
    minHeight: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
