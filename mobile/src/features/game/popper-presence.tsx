import { StyleSheet, View } from 'react-native';

import type { RoomPlayer } from '@/api';
import { Avatar } from '@/components/avatar';
import type { PhotoTone } from '@/components/photo';
import { ThemedText } from '@/components/themed-text';
import { useScheme, useTheme } from '@/hooks/use-theme';

const AVATAR_SIZE = 64;
/** Avatar to name, as on the canvas. */
const AVATAR_GAP = 14;

/**
 * The popper holds no seat, so their tile is neutral (the canvas's --me-t): their
 * initial on surface, one step brighter by night so it still stands off the page.
 */
export function useNeutralTone(): PhotoTone {
  const theme = useTheme();
  const scheme = useScheme();
  return { color: theme.text, tint: scheme === 'dark' ? theme.surfacePressed : theme.surface };
}

/** The person everyone is trying to win, above the question, for contestants and watchers. */
export function PopperPresence({ popper }: { popper: RoomPlayer }) {
  const tone = useNeutralTone();
  return (
    <View
      style={styles.presence}
      accessible
      accessibilityLabel={`${popper.name}, ${popper.age}, is choosing`}>
      <Avatar name={popper.name} uri={popper.photos[0]} tone={tone} size={AVATAR_SIZE} />
      <View style={styles.copy}>
        <ThemedText type="task">{popper.name} is choosing</ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {popper.age}
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
