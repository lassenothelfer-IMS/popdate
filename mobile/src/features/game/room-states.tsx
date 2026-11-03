import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useT } from '@/i18n';
import { goHome } from '@/utils/navigation';

/** A room that won't load in a while: says so and offers a retry, rather than spin forever. */
export function RoomSlow({ roomId }: { roomId: string }) {
  const t = useT();
  return (
    <Screen
      footerStyle="plain"
      contentStyle={styles.centered}
      footer={
        <>
          <Button
            title={t('common.tryAgain')}
            onPress={() => router.replace({ pathname: '/room/[id]', params: { id: roomId } })}
          />
          <Button title={t('game.backHome')} variant="plain" onPress={goHome} />
        </>
      }>
      <ThemedText type="title" accessibilityRole="header" style={styles.centeredText}>
        {t('game.roomSlowTitle')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.centeredText}>
        {t('game.roomSlowBody')}
      </ThemedText>
    </Screen>
  );
}

/** The room is gone: it ended, or you were never in it. */
export function RoomGone() {
  const t = useT();
  return (
    <Screen
      scroll
      contentStyle={styles.center}
      footer={<Button title={t('game.backHome')} onPress={goHome} />}>
      <ThemedText themeColor="textSecondary" style={styles.centeredText}>
        {t('game.roomGone')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Space.sm,
  },
  centeredText: {
    textAlign: 'center',
  },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
  },
});
