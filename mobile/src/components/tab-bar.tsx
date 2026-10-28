import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Balloon } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { BrandBalloon, MinTouch, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

export type Tab = 'home' | 'matches' | 'settings';

const ROUTES: Record<Tab, Href> = {
  home: '/home',
  matches: '/matches' as Href,
  settings: '/settings' as Href,
};

type TabBarProps = {
  active: Tab;
  labels: Record<Tab, string>;
};

/**
 * The web's tab bar on Home, Matches and Settings (phones use the system tab bar,
 * see `app/(tabs)/_layout.tsx`): a pill on surface 1 with a hairline, 20 pt from
 * the sides and 30 pt from the bottom. Three 44 x 36 items:
 * the balloon (home), a chat bubble (matches) and a gear (settings).
 */
export function TabBar({ active, labels }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs: Tab[] = ['home', 'matches', 'settings'];
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
                router.replace(ROUTES[tab]);
              }}
              style={styles.item}>
              {tab === 'home' ? (
                <View style={{ opacity: selected ? 1 : 0.6 }}>
                  <Balloon color={selected ? BrandBalloon.color : color} size={14} string={false} />
                </View>
              ) : (
                <Icon name={tab === 'matches' ? 'bubble' : 'gear'} size={19} color={color} />
              )}
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
