import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Question } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { sentence } from '@/features/game/announce';
import { QuestionPicker } from '@/features/game/question-picker';
import { pickingOut } from '@/features/game/room-motion';
import { useT } from '@/i18n';

type PickingViewProps = {
  isPopper: boolean;
  popperName: string;
  round: number;
  options: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  asking: boolean;
  /** Balloons still up. */
  upCount: number;
  /** How the phase arrives: after the pop news from round 2 on. */
  entering: ComponentProps<typeof Animated.View>['entering'];
};

/** The picking phase: the chooser's question picker, or the line everyone else waits on. */
export function PickingView(props: PickingViewProps) {
  const t = useT();
  if (props.isPopper) {
    return (
      // No exit fade: the question moves up into the picker's place at once,
      // and would be drawn over its fading options. Your tap explains the change.
      <Animated.View key="picker" entering={props.entering} style={styles.first}>
        <QuestionPicker
          options={props.options}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
          locked={props.asking}
          answering={props.upCount}
        />
      </Animated.View>
    );
  }
  return (
    <Animated.View
      key="picking"
      entering={props.entering}
      exiting={pickingOut}
      style={styles.pickingLine}>
      <ThemedText type="callout" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {t('game.isPicking', { name: props.popperName })}…
        {props.round > 1
          ? ` ${sentence(t('game.balloonsLeft', { count: props.upCount }))}`
          : ''}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** The first block under the room bar. */
  first: {
    marginTop: 20,
  },
  pickingLine: {
    marginTop: Space.md,
  },
});
