import { Platform, StyleSheet, View } from 'react-native';

import { BackButton } from '@/features/onboarding/back-button';

/**
 * Back, at the top of a pushed page. On iOS the system's navigation bar draws
 * it (see `nativeBack` in the root layout): its own chevron, glass on iOS 26,
 * and the swipe from the edge. The page then only keeps the bar's height free.
 * Android and the web draw the app's own button.
 */
export function PageBack({ onPress }: { onPress: () => void }) {
  if (Platform.OS === 'ios') return <View style={styles.bar} />;
  return <BackButton onPress={onPress} />;
}

const styles = StyleSheet.create({
  // A navigation bar is 44 pt under the status bar.
  bar: {
    height: 44,
  },
});
