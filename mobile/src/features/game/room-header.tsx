import type { LayoutChangeEvent } from 'react-native';

import type { Room, RoomStatus } from '@/api';
import { BalloonStage } from '@/features/game/balloon-stage';
import { RoomBar } from '@/features/game/room-bar';
import type { RoomPhase } from '@/features/game/room-phase';
import { RoundTimer } from '@/features/game/round-timer';
import { useT, type Translate } from '@/i18n';

function phaseLabel(t: Translate, status: Exclude<RoomStatus, 'finished'>) {
  switch (status) {
    case 'picking':
      return t('game.phasePicking');
    case 'answering':
      return t('game.phaseAnswering');
    case 'popping':
      return t('game.phasePopping');
  }
}

/** "Round 2 of 4", "Final two" or "Final". */
export function roomTitle(t: Translate, room: Room, phase: RoomPhase) {
  if (phase.finished) return t('game.final');
  if (phase.finalTwo) return t('game.finalTwo');
  return t('game.roundOf', { round: room.round, total: room.totalRounds });
}

type RoomHeaderProps = {
  room: Room;
  phase: RoomPhase;
  watching: boolean;
  leaving: boolean;
  /** The answer cards at least half in view, while the chooser reveals them. */
  inView: string[] | null;
  onLeave: () => void;
  onMore: () => void;
  onSelect: (id: string) => void;
  /** Whose turn it is in the live reveal, if it is running. */
  spotlightId: string | null;
  /** Set while the chooser may pop: holding a balloon on the stage pops it. */
  onPop?: (id: string) => void;
  /** People whose newest photo the reveal hasn't shown yet. */
  unrevealed: ReadonlySet<string>;
  onLayout: (event: LayoutChangeEvent) => void;
};

/** The room bar, filled in for the phase you are in. */
export function RoomHeader({
  room,
  phase,
  watching,
  leaving,
  inView,
  onLeave,
  onMore,
  onSelect,
  spotlightId,
  onPop,
  unrevealed,
  onLayout,
}: RoomHeaderProps) {
  const t = useT();
  const { finished, answering, isPopping, pending, selected, me } = phase;
  const roundOf = t('game.roundOf', { round: room.round, total: room.totalRounds });
  const subtitle = finished
    ? phase.winner
      ? t('game.roundsPlayed', { count: room.round })
      : t('game.endedEarlyShort')
    : phaseLabel(t, room.status as Exclude<RoomStatus, 'finished'>);

  return (
    <RoomBar
      title={roomTitle(t, room, phase)}
      titleLabel={
        phase.finalTwo
          ? t('game.finalTwoLabel', { round: room.round, total: room.totalRounds })
          : undefined
      }
      subtitle={subtitle}
      watching={watching && !finished}
      timer={
        // During the live reveal the pop time hasn't started: the ring waits for it.
        (answering || isPopping || room.status === 'picking') && !phase.spotlight ? (
          <RoundTimer
            deadline={room.deadline}
            warn={answering && phase.iAmActive && !me?.answered}
          />
        ) : null
      }
      onLeave={finished ? undefined : onLeave}
      onMore={onMore}
      leaving={leaving}
      rounds={{
        total: room.totalRounds,
        filled: Math.min(room.round, room.totalRounds),
        label: finished
          ? t('game.roundsPlayedOf', { round: room.round, total: room.totalRounds })
          : roundOf,
      }}
      rail={
        <BalloonStage
          contestants={room.contestants}
          meId={room.me.id}
          markedId={pending ? null : (selected?.id ?? null)}
          poppingId={pending?.id ?? null}
          risenId={finished ? room.winnerId : null}
          inView={phase.revealing ? inView : null}
          spotlightId={spotlightId}
          answering={answering}
          unrevealed={unrevealed}
          onSelect={phase.canSelect && phase.revealing ? onSelect : undefined}
          onPop={phase.canSelect && phase.revealing ? onPop : undefined}
        />
      }
      onLayout={onLayout}
    />
  );
}
