import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { TAB_ROUTES, TabBar, TabPageContext, TABS, type Tab } from '@/components/tab-bar';
import { HomeScreen } from '@/features/home/home-screen';
import { ProfileViewScreen } from '@/features/home/profile-view-screen';
import { MatchesScreen } from '@/features/matches/matches-screen';
import { useYourTurnCount } from '@/features/matches/use-your-turn';
import { RoomsScreen } from '@/features/rooms/rooms-screen';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

const ORDER = TABS;
const ROUTES = TAB_ROUTES;

function tabOf(pathname: string): number {
  const index = ORDER.findIndex((tab) => pathname.startsWith(`/${tab}`));
  return index < 0 ? 0 : index;
}

/**
 * Play, Rooms, Matches and You side by side: swipe and the next page follows the
 * finger, or tap the floating tab bar. The URL follows the page, so links to
 * /home, /rooms, /matches or /you land on the right one. All four stay mounted,
 * so a page keeps its scroll and state while you're on another. Each page knows
 * whether it's the one showing (TabPageContext): it reloads when you page to it
 * and holds its loops and polls still while it's off screen.
 */
export default function TabsLayout() {
  const t = useT();
  const pathname = usePathname();
  const yourTurn = useYourTurnCount();
  const pager = useRef<PagerView>(null);
  const routeIndex = tabOf(pathname);
  const [page, setPage] = useState(routeIndex);

  // Arriving by a link (Back to home from a match, a push): slide to that page.
  useEffect(() => {
    if (routeIndex !== page) pager.current?.setPage(routeIndex);
    // Only a new route moves the pager; the pager itself moves `page`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIndex]);

  function select(tab: Tab) {
    pager.current?.setPage(ORDER.indexOf(tab));
  }

  return (
    <View style={styles.fill}>
      <PagerView
        ref={pager}
        style={styles.fill}
        initialPage={routeIndex}
        onPageSelected={({ nativeEvent }) => {
          const index = nativeEvent.position;
          if (index === page) return;
          setPage(index);
          haptics.selection();
          if (index !== tabOf(pathname)) router.navigate(ROUTES[ORDER[index]]);
        }}>
        <View key="home" style={styles.fill}>
          <TabPageContext value={page === 0}>
            <HomeScreen />
          </TabPageContext>
        </View>
        <View key="rooms" style={styles.fill}>
          <TabPageContext value={page === 1}>
            <RoomsScreen />
          </TabPageContext>
        </View>
        <View key="matches" style={styles.fill}>
          <TabPageContext value={page === 2}>
            <MatchesScreen />
          </TabPageContext>
        </View>
        <View key="you" style={styles.fill}>
          <TabPageContext value={page === 3}>
            <ProfileViewScreen asTab />
          </TabPageContext>
        </View>
      </PagerView>
      <TabBar
        active={ORDER[page]}
        labels={{
          home: t('home.tabHome'),
          rooms: t('home.tabRooms'),
          matches: t('home.tabMatches'),
          you: t('home.tabYou'),
        }}
        onSelect={select}
        dots={{ matches: yourTurn > 0 }}
        dotLabels={{ matches: t('home.tabMatchesYourTurn') }}
      />
      {/* The routes themselves render nothing; the pages above are the screens. */}
      <View style={styles.hidden}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
