import { Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TabBar, TABS, type Tab } from '@/components/tab-bar';
import { useYourTurnCount } from '@/features/matches/use-your-turn';
import { useT } from '@/i18n';

/**
 * The web has no system tab bar: the tab screens share the app's own floating one.
 * Each tab is its own route here, so plain screen focus tells a page it's showing.
 */
export default function TabsLayout() {
  const t = useT();
  const pathname = usePathname();
  const yourTurn = useYourTurnCount();
  const active: Tab = TABS.find((tab) => pathname.startsWith(`/${tab}`)) ?? 'home';
  return (
    <View style={styles.fill}>
      <Slot />
      <TabBar
        active={active}
        labels={{
          home: t('home.tabHome'),
          rooms: t('home.tabRooms'),
          matches: t('home.tabMatches'),
          you: t('home.tabYou'),
        }}
        counts={{ matches: yourTurn }}
        dotLabels={{ matches: t('home.tabMatchesYourTurn') }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
