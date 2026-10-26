import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ProgressSegments } from '@/components/progress-segments';
import { ThemedText } from '@/components/themed-text';
import { Gutter, MinTouch, Space } from '@/constants/theme';
import { Pill } from '@/features/game/you-tag';
import { useTheme } from '@/hooks/use-theme';

/**
 * The bar's words grow with the text size up to here, like the rail's names. Past
 * it, the title, timer and Leave no longer fit one 335pt row: the title column
 * collapses to a letter per line and Leave is pushed off the screen. VoiceOver
 * reads every label in full.
 */
export const BAR_TEXT_MAX_SCALE = 1.35;

type RoomBarProps = {
  /** "Round 2 of 4", "Final two" or "Final". */
  title: string;
  /** What VoiceOver reads for the title, when it says more than the title. */
  titleLabel?: string;
  /** The phase, or how the game ended. Always present, so the bar never changes height. */
  subtitle: string;
  watching: boolean;
  /** The countdown pill, while a timer runs. */
  timer?: ReactNode;
  /** Hidden once the game is over. */
  onLeave?: () => void;
  leaving: boolean;
  /** The four round segments: filled up to the round being played. */
  rounds: { total: number; filled: number; label: string };
  /** The five seats. */
  rail: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** The pinned top of the room: round and phase, timer, Leave, the rounds and the seats. */
export function RoomBar({
  title,
  titleLabel,
  subtitle,
  watching,
  timer,
  onLeave,
  leaving,
  rounds,
  rail,
  onLayout,
}: RoomBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.bar} onLayout={onLayout}>
      <View style={styles.top}>
        <View style={styles.titles}>
          <ThemedText
            type="headline"
            accessibilityRole="header"
            accessibilityLabel={titleLabel}
            maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE}>
            {title}
          </ThemedText>
          <View style={styles.phase}>
            <ThemedText
              type="footnote"
              themeColor="textSecondary"
              maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE}
              style={styles.shrink}>
              {subtitle}
            </ThemedText>
            {watching ? <Pill label="Watching" tone="quiet" /> : null}
          </View>
        </View>
        {timer || onLeave ? (
          <View style={styles.actions}>
            {timer}
            {onLeave ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Leave room"
                accessibilityState={{ busy: leaving, disabled: leaving }}
                disabled={leaving}
                onPress={onLeave}
                hitSlop={{ right: Space.sm }}
                style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
                {leaving ? (
                  <ActivityIndicator color={theme.textSecondary} />
                ) : (
                  <ThemedText type="label" maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE}>
                    Leave
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.rounds}>
        <ProgressSegments
          total={rounds.total}
          filled={rounds.filled}
          accessibilityLabel={rounds.label}
        />
      </View>

      <View
        style={[
          styles.rail,
          {
            borderBottomColor: theme.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        {rail}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: Space.sm,
    paddingHorizontal: Gutter,
  },
  top: {
    minHeight: MinTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  titles: {
    flex: 1,
  },
  phase: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  shrink: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xxs,
  },
  leave: {
    minWidth: MinTouch,
    minHeight: MinTouch,
    paddingLeft: Space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  rounds: {
    marginTop: Space.xs,
  },
  rail: {
    marginTop: 14,
    paddingBottom: Space.sm,
  },
});
