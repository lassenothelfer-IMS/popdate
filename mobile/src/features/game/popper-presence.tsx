import { StyleSheet, View } from 'react-native';

import type { RoomPlayer } from '@/api';
import { Avatar } from '@/components/avatar';
import type { PhotoTone } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const AVATAR_SIZE = 64;
/** Avatar to name, as on the canvas. */
const AVATAR_GAP = 14;

/**
 * The popper holds no seat, so their tile is neutral: their initial in cream on
 * plush, like every avatar.
 */
export function useNeutralTone(): PhotoTone {
  const theme = useTheme();
  return { color: theme.text, tint: theme.surface };
}

/** The person everyone is trying to win, above the question, for contestants and watchers. */
export function PopperPresence({ popper }: { popper: RoomPlayer }) {
  const tone = useNeutralTone();
  const t = useT();
  return (
    <View
      style={styles.presence}
      accessible
      accessibilityLabel={t('game.isChoosingLabel', { name: popper.name, age: popper.age })}>
      <Avatar name={popper.name} uri={popper.photos[0]} tone={tone} size={AVATAR_SIZE} />
      {/* "Alina, 32" over "is choosing", like the contestants' "Sam, 28". */}
      <View style={styles.copy}>
        <ThemedText type="task">{t('common.nameAge', { name: popper.name, age: popper.age })}</ThemedText>
        <ThemedText type="footnote" themeColor="textTertiary">
          {t('game.isChoosingLine')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AVATAR_GAP,
  },
  copy: {
    flex: 1,
  },
});
