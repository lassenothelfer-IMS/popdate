import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { AnswerComposer, AnswerSent } from '@/features/game/answer-composer';
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
  const { replaying } = props;

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
    case 'hold':
      // No button: you pop by holding a balloon at the top. The bar says so, and for
      // the final two, what it means. The final two pops like every round.
      return (
        <Animated.View entering={reduced ? popButtonFade : popButtonIn} style={styles.popFooter}>
          <ThemedText type="heading" style={styles.centerText}>
            {t('game.holdBalloon')}
          </ThemedText>
          {props.up.length === 2 ? (
            <ThemedText type="body" style={styles.centerText}>
              {t('game.finalTwoHint')}
            </ThemedText>
          ) : null}
        </Animated.View>
      );
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
