import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { TAB_ROUTES, TABS, type Tab } from '@/components/tab-bar';
import { haptics } from '@/utils/haptics';


/** A swipe counts once it travels this far, or is flicked this fast. */
const DISTANCE = 60;
const VELOCITY = 500;

/**
 * The web's swipe between tabs: a sideways swipe moves to the next or previous
 * tab once it ends. Phones page with the finger instead (`app/(tabs)/_layout.tsx`),
 * so there this passes its children straight through.
 */
export function TabSwipe({ tab, children }: { tab: Tab; children: ReactNode }) {
  function go(step: 1 | -1) {
    const next = TABS[TABS.indexOf(tab) + step];
    if (!next) return;
    haptics.selection();
    router.navigate(TAB_ROUTES[next]);
  }

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd(({ translationX, velocityX }) => {
      if (Math.abs(translationX) < DISTANCE && Math.abs(velocityX) < VELOCITY) return;
      go(translationX < 0 ? 1 : -1);
    });

  if (Platform.OS !== 'web') return children;
  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={swipe}>{children}</GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
