import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { AnswerComposer, AnswerSent } from '@/features/game/answer-composer';
import { HoldToPopButton } from '@/features/game/hold-to-pop';
import { popButtonFade, popButtonIn } from '@/features/game/room-motion';
import type { RoomFooterKind } from '@/features/game/room-phase';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';
import { goHome } from '@/utils/navigation';

type RoomFooterProps = {
  kind: RoomFooterKind;
  roomId: string;
  popperName: string;
  deadline: number | null;
  showHints: boolean;
  replaying: boolean;
  onPlayAgain: () => void;
  /** This round's answer draft. */
  draft: string;
  onChangeDraft: (text: string) => void;
  onSend: (text: string) => Promise<void>;
  onFocusAnswer: () => void;
  /** The marked question, while picking. */
  canAsk: boolean;
  asking: boolean;
  onAsk: () => void;
  /** How the Ask button arrives: after the pop news from round 2 on. */
  askEntering: ComponentProps<typeof Animated.View>['entering'];
  /** Balloons still up, for the final two. */
  up: Contestant[];
  /** The marked balloon, and its seat's balloon color. */
  selected: Contestant | undefined;
  selectedColor: string | undefined;
  onPop: (target: Contestant) => void;
};

/** The room's action at the bottom, for the phase you are in. */
export function RoomFooter(props: RoomFooterProps) {
  const t = useT();
  const reduced = useReduceMotion();
  const { replaying, showHints } = props;

  switch (props.kind) {
    // When the chooser left, the room didn't count: you can get back in line right away.
    case 'nextRoom':
      return (
        <>
          <Button title={t('game.nextRoomLine')} loading={replaying} onPress={props.onPlayAgain} />
          <Button variant="plain" title={t('game.backHome')} disabled={replaying} onPress={goHome} />
        </>
      );
    // Popped and stayed to watch: no match opens for you, so the room offers its recap and the next room.
    case 'recap':
      return (
        <>
          <Button
            title={t('match.recap')}
            disabled={replaying}
            onPress={() => router.push({ pathname: '/recap/[id]', params: { id: props.roomId } })}
          />
          <Button
            variant="tinted"
            title={t('game.playAnother')}
            loading={replaying}
            onPress={props.onPlayAgain}
          />
          <Button variant="plain" title={t('game.backHome')} disabled={replaying} onPress={goHome} />
        </>
      );
    case 'home':
      return <Button title={t('game.backHome')} onPress={goHome} />;
    case 'sent':
      return <AnswerSent popperName={props.popperName} />;
    case 'composer':
      return (
        <AnswerComposer
          value={props.draft}
          onChangeText={props.onChangeDraft}
          onSend={props.onSend}
          onFocus={props.onFocusAnswer}
          popperName={props.popperName}
          deadline={props.deadline}
        />
      );
    case 'ask':
      return (
        <Animated.View entering={props.askEntering}>
          <Button
            title={t('game.askThis')}
            disabled={!props.canAsk}
            loading={props.asking}
            onPress={props.onAsk}
          />
        </Animated.View>
      );
    case 'hold': {
      const { selected } = props;
      // The final two pops like every round: the one you don't pop is your match.
      const hint = props.up.length === 2 ? t('game.finalTwoHint') : showHints ? t('game.holdToPop') : null;
      // The bar is there from the reveal on, so marking a card never moves the page.
      // Held on the button itself: the pop only goes out once the fill is full.
      // Keyed by the balloon, so marking someone else starts a fresh hold.
      return (
        <Animated.View entering={reduced ? popButtonFade : popButtonIn} style={styles.popFooter}>
          {hint ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.centerText}>
              {hint}
            </ThemedText>
          ) : null}
          {selected && props.selectedColor ? (
            <HoldToPopButton
              key={selected.id}
              name={selected.name}
              balloonColor={props.selectedColor}
              onPop={() => props.onPop(selected)}
            />
          ) : (
            <Button title={t('game.pickToPop')} disabled />
          )}
        </Animated.View>
      );
    }
  }
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  popFooter: {
    gap: Space.sm,
  },
});
