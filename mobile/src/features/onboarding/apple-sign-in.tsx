import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

/** The same height as the app's large buttons. */
const BUTTON_HEIGHT = 52;

type AppleSignInProps = {
  /** Signed in. `givenName` is your first name when Apple shares it (only the first time). */
  onSignedIn: (hasProfile: boolean, givenName?: string | null) => void;
};

/**
 * Apple's own "Continue with Apple" button, the way Apple asks for it to look,
 * and in development a test account under it. The web preview and Android,
 * which have no Sign in with Apple here, get the test account only in
 * development, and a plain line otherwise.
 */
export function AppleSignIn({ onSignedIn }: AppleSignInProps) {
  const t = useT();
  const theme = useTheme();
  const { signInWithApple, signInAsGuest } = useSession();
  /** Null while it is still being checked. */
  const [apple, setApple] = useState<boolean | null>(Platform.OS === 'ios' ? null : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    AppleAuthentication.isAvailableAsync().then(
      (available) => {
        if (active) setApple(available);
      },
      () => {
        if (active) setApple(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function withApple() {
    if (busy) return;
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      setBusy(true);
      const hasProfile = await signInWithApple(credential.identityToken);
      haptics.success();
      onSignedIn(hasProfile, credential.fullName?.givenName);
    } catch (failure) {
      // Closing Apple's sheet isn't an error.
      if ((failure as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      haptics.error();
      setError(t('onboarding.signInFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function asGuest() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      onSignedIn(await signInAsGuest());
    } catch {
      haptics.error();
      setError(t('onboarding.signInFailed'));
    } finally {
      setBusy(false);
    }
  }

  const testAccount = __DEV__ ? (
    <Button title={t('onboarding.testAccount')} variant="plain" disabled={busy} onPress={() => void asGuest()} />
  ) : null;

  return (
    <View style={styles.actions}>
      {error ? <ErrorLine message={error} /> : null}
      {apple === null ? (
        <View style={styles.button} />
      ) : apple ? (
        <View>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={BUTTON_HEIGHT / 2}
            style={[styles.button, busy && styles.busy]}
            onPress={() => void withApple()}
          />
          {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color={theme.page} /> : null}
        </View>
      ) : testAccount ? null : (
        <ThemedText type="body" style={styles.center}>
          {t('onboarding.appleOnly')}
        </ThemedText>
      )}
      {testAccount}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 6,
  },
  button: {
    height: BUTTON_HEIGHT,
    width: '100%',
  },
  busy: {
    opacity: 0.5,
  },
  center: {
    textAlign: 'center',
  },
});
