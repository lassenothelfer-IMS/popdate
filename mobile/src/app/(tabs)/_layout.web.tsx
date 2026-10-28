import { Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TabBar, type Tab } from '@/components/tab-bar';
import { useT } from '@/i18n';

/** The web has no system tab bar: the tab screens share the app's own floating one. */
export default function TabsLayout() {
  const t = useT();
  const pathname = usePathname();
  const active: Tab = pathname.startsWith('/matches')
    ? 'matches'
    : pathname.startsWith('/settings')
      ? 'settings'
      : 'home';
  return (
    <View style={styles.fill}>
      <Slot />
      <TabBar
        active={active}
        labels={{ home: t('home.tabHome'), matches: t('home.tabMatches'), settings: t('home.settings') }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
