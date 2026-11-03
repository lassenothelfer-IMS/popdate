import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { api } from '@/api';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';

export default function Index() {
  const { ready, failed, retry, profile, onboarding } = useSession();
  // Reopened mid-room: go straight back in. Undefined while still asking.
  const [activeRoom, setActiveRoom] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ready || !profile) return;
    let cancelled = false;
    api
      .getActiveRoom()
      .catch(() => null)
      .then((roomId) => {
        if (!cancelled) setActiveRoom(roomId);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, profile]);

  if (failed) return <SignInFailed onRetry={retry} />;
  if (!ready) return null;
  if (profile) {
    if (activeRoom === undefined) return null;
    return <Redirect href={activeRoom ? (`/room/${activeRoom}` as Href) : '/home'} />;
  }
  return <Redirect href={onboarding ? '/profile-setup' : '/onboarding'} />;
}

/** Signing in failed or hung: say so plainly, with a way to try again. */
function SignInFailed({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <Screen scroll contentStyle={styles.failed}>
      <ThemedText type="title" accessibilityRole="header" style={styles.text}>
        {t('common.signInFailedTitle')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.text}>
        {t('common.signInFailedBody')}
      </ThemedText>
      <Button title={t('common.tryAgain')} fullWidth={false} onPress={onRetry} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  failed: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Space.sm,
  },
  text: {
    textAlign: 'center',
  },
  button: {
    marginTop: Space.md,
  },
});
