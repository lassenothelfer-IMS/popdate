import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, useFocusEffect, type Href } from 'expo-router';
import { createContext, use, useCallback, type EffectCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Fonts, Radius } from '@/constants/theme';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useSession } from '@/state/session';
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

/**
 * Line icons in a 24 x 24 box, drawn here so they match on every platform:
 * the balloon (home), a clock turning back (your rooms) and a speech bubble (matches).
 */
const ICON_PATHS: Record<Exclude<Tab, 'you'>, string[]> = {
  home: [
    'M12 3c-3.6 0-6 2.8-6 6.4 0 4 3.1 7.4 6 8 2.9-.6 6-4 6-8C18 5.8 15.6 3 12 3z',
    'M12 17.4l-1.2 1.8h2.4z',
    'M12 19.2c-.8 1.1.8 1.8 0 2.8',
  ],
  rooms: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4v3.5H8', 'M12 8.2V12l2.8 1.8'],
  matches: ['M7 4.5h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6.2L6.5 20v-3.5A3 3 0 0 1 4 13.5v-6a3 3 0 0 1 3-3z'],
};
/**
 * Whether the pager page this sits in is the one showing. The phone's tabs layout
 * provides it around each page; everywhere else (the web's tab routes, pushed
 * screens) it's true, since a screen there is only mounted while it's open.
 */
export const TabPageContext = createContext(true);

/** True while this tab page is the one on screen, or always outside the pager. */
export function useTabActive() {
  return use(TabPageContext);
}

/**
 * useFocusEffect for a tab page. On the phone all four pages stay mounted in one
 * pager, so screen focus alone misses a swipe: this runs `effect` when the screen
 * gains focus while its page is showing, and again each time you page back to it,
 * and cleans up when either goes. Pass a stable callback (useCallback).
 */
export function useTabFocus(effect: EffectCallback) {
  const active = useTabActive();
  useFocusEffect(useCallback(() => (active ? effect() : undefined), [active, effect]));
}

const ICON = 24;
const AVATAR = 26;

type TabBarProps = {
  active: Tab;
  labels: Record<Tab, string>;
  /** Called instead of navigating, like the phone's pager sliding to that page. */
  onSelect?: (tab: Tab) => void;
  /** Tabs that wear a numbered badge, like Matches with the chats waiting on you. Zero shows none. */
  counts?: Partial<Record<Tab, number>>;
  /** What a screen reader says for a tab while it wears its badge, like "Matches, your turn". */
  dotLabels?: Partial<Record<Tab, string>>;
};

/** Real Liquid Glass only where the system draws it (iOS 26); elsewhere the sheet color. */
const GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * The tab bar floating over the pages: a Liquid Glass pill (the sheet color with a
 * hairline where glass isn't drawn), 16 pt from the sides. Each tab is an icon
 * over its name; the selected one sits in a soft gray capsule. You is your own photo.
 */
export function TabBar({ active, labels, onSelect, counts, dotLabels }: TabBarProps) {
  const theme = useTheme();
  const seats = useSeats();
  const { profile } = useSession();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(insets.bottom, 24) }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          GLASS
            ? styles.glassPill
            : { backgroundColor: theme.sheet, borderColor: theme.border },
        ]}>
        {GLASS ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="light"
            style={[StyleSheet.absoluteFill, styles.glass]}
          />
        ) : null}
        {TABS.map((tab) => {
          const selected = tab === active;
          const color = selected ? theme.accentText : theme.textSecondary;
          const count = counts?.[tab] ?? 0;
          const dotted = count > 0;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityLabel={dotted ? (dotLabels?.[tab] ?? labels[tab]) : labels[tab]}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                if (onSelect) onSelect(tab);
                else router.replace(TAB_ROUTES[tab]);
              }}
              style={({ pressed }) => [
                styles.item,
                selected && { backgroundColor: theme.accentWash },
                pressed && !selected && { backgroundColor: theme.surfacePressed },
              ]}>
              <View style={styles.icon}>
                {tab === 'you' ? (
                  <View
                    style={[
                      styles.avatarRing,
                      { borderColor: selected ? theme.accentText : 'transparent' },
                    ]}>
                    <Avatar
                      name={profile?.name ?? labels.you}
                      uri={profile?.photos[0]}
                      tone={youSeat(seats)}
                      size={AVATAR}
                    />
                  </View>
                ) : (
                  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
                    {ICON_PATHS[tab].map((d) => (
                      <Path
                        key={d}
                        d={d}
                        stroke={color}
                        strokeWidth={1.9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                  </Svg>
                )}
                {dotted ? (
                  <View style={[styles.badge, { backgroundColor: theme.brand, borderColor: theme.sheet }]}>
                    <Text maxFontSizeMultiplier={1} style={[styles.badgeText, { color: theme.onBrand }]}>
                      {count > 9 ? '9+' : count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[styles.label, { color }, selected && styles.labelSelected]}>
                {labels[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Space to leave under scrolling content so a tab bar floating over it never covers it. */
export const TAB_BAR_CLEARANCE = 64 + 24 + 16;

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    padding: 5,
    gap: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glassPill: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  glass: {
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
  icon: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    padding: 1,
    borderRadius: (AVATAR + 4) / 2,
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: 500,
  },
  labelSelected: {
    fontWeight: 600,
  },
});
