import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { Button } from '@/components/button';
import { ProgressSegments } from '@/components/progress-segments';
import { ThemedText } from '@/components/themed-text';
import { Gutter, MinTouch, Space } from '@/constants/theme';
import { Pill } from '@/features/game/you-tag';
import { useTheme } from '@/hooks/use-theme';
import { MoreButton } from '@/features/chat/person-actions';
import { useT } from '@/i18n';

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
  /** Report or block someone in the room. */
  onMore?: () => void;
  leaving: boolean;
  /** The four round segments: filled up to the round being played. */
  rounds: { total: number; filled: number; label: string };
  /** The five seats. */
  rail: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The room header: "Round 1 of 4" over the phase on the left, the ring timer
 * and a Leave pill on the right, then the four round segments and the seats.
 */
export function RoomBar({
  title,
  titleLabel,
  subtitle,
  watching,
  timer,
  onLeave,
  onMore,
  leaving,
  rounds,
  rail,
  onLayout,
}: RoomBarProps) {
  const theme = useTheme();
  const t = useT();
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
              type="caption"
              themeColor="textSecondary"
              maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE}
              style={styles.shrink}>
              {subtitle}
            </ThemedText>
            {watching ? <Pill label={t('game.watching')} tone="quiet" /> : null}
          </View>
        </View>
        {timer || onLeave || onMore ? (
          <View style={styles.actions}>
            {timer}
            {onMore ? <MoreButton label={t('game.reportSomeone')} onPress={onMore} /> : null}
            {onLeave ? (
              <Button
                title={t('game.leave')}
                variant="tinted"
                size="small"
                fullWidth={false}
                loading={leaving}
                onPress={onLeave}
              />
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
    paddingTop: Space.xs,
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
    gap: Space.xs,
  },
  rounds: {
    marginTop: Space.md,
  },
  rail: {
    marginTop: Space.lg,
    paddingBottom: Space.md,
  },
});
