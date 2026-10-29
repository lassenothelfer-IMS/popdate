import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Balloon } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { BrandBalloon, MinTouch, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

export type Tab = 'home' | 'rooms' | 'matches' | 'you';

/** The tabs in the order they sit on the bar, and their routes. */
export const TABS: Tab[] = ['home', 'rooms', 'matches', 'you'];
export const TAB_ROUTES: Record<Tab, Href> = {
  home: '/home',
  rooms: '/rooms' as Href,
  matches: '/matches' as Href,
  you: '/you' as Href,
};

const ICONS = { rooms: 'rooms', matches: 'bubble', you: 'person' } as const;

type TabBarProps = {
  active: Tab;
  labels: Record<Tab, string>;
  /** Called instead of navigating, like the phone's pager sliding to that page. */
  onSelect?: (tab: Tab) => void;
  /** Tabs that wear a small dot, like Matches while a chat is waiting on you. */
  dots?: Partial<Record<Tab, boolean>>;
};

/**
 * The tab bar on Home, Matches and Settings, floating over the pages: a pill on
 * surface 1 with a hairline, 20 pt from the sides and 30 pt from the bottom. Three 44 x 36 items:
 * the balloon (home), a chat bubble (matches) and a gear (settings).
 */
export function TabBar({ active, labels, onSelect, dots }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = TABS;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(insets.bottom, 30) }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { backgroundColor: theme.sheet, borderColor: theme.border }]}>
        {tabs.map((tab) => {
          const selected = tab === active;
          const color = selected ? theme.text : theme.textTertiary;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={labels[tab]}
              accessibilityState={{ selected }}
              aria-selected={selected}
              hitSlop={4}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                if (onSelect) onSelect(tab);
                else router.replace(TAB_ROUTES[tab]);
              }}
              style={styles.item}>
              {tab === 'home' ? (
                <View style={{ opacity: selected ? 1 : 0.6 }}>
                  <Balloon color={selected ? BrandBalloon.color : color} size={14} />
                </View>
              ) : (
                <Icon name={ICONS[tab]} size={19} color={color} />
              )}
              {dots?.[tab] ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Space to leave under scrolling content so a tab bar floating over it never covers it. */
export const TAB_BAR_CLEARANCE = 36 + 12 + 30 + 16;

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  layer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    width: 44,
    height: 36,
    minHeight: MinTouch - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
