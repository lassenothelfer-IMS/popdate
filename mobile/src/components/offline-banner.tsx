import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * A quiet pill at the top of every screen while the server can't be reached.
 * Rooms and chats pick up where they were once it's back.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);

  useEffect(() => api.watchConnection(setOnline), []);

  if (online) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { top: insets.top + Space.xs }]}>
      <Animated.View
        entering={FadeIn.duration(Motion.state)}
        exiting={FadeOut.duration(Motion.exit)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.pill, { backgroundColor: theme.inverse }]}>
        <ThemedText type="captionStrong" style={{ color: theme.onInverse }}>
          {t('common.offline')}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
  },
});
