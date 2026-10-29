import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import type { Tab } from '@/components/tab-bar';
import { haptics } from '@/utils/haptics';

/** The tabs in the order they sit on the tab bar. */
const ORDER: Tab[] = ['home', 'matches', 'settings'];
const ROUTES: Record<Tab, Href> = {
  home: '/home',
  matches: '/matches' as Href,
  settings: '/settings' as Href,
};

/** A swipe counts once it travels this far, or is flicked this fast. */
const DISTANCE = 60;
const VELOCITY = 500;

/**
 * Swipe left or right on a tab screen to move to the next or previous tab, as
 * on the tab bar. It only takes clearly sideways swipes, so scrolling up and
 * down is untouched.
 */
export function TabSwipe({ tab, children }: { tab: Tab; children: ReactNode }) {
  function go(step: 1 | -1) {
    const next = ORDER[ORDER.indexOf(tab) + step];
    if (!next) return;
    haptics.selection();
    router.navigate(ROUTES[next]);
  }

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd(({ translationX, velocityX }) => {
      if (Math.abs(translationX) < DISTANCE && Math.abs(velocityX) < VELOCITY) return;
      go(translationX < 0 ? 1 : -1);
    });

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
