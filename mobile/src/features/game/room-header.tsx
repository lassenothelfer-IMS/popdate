import type { LayoutChangeEvent } from 'react-native';

import type { Room, RoomStatus } from '@/api';
import { BalloonRail } from '@/features/game/balloon-rail';
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
        <BalloonRail
          contestants={room.contestants}
          meId={room.me.id}
          markedId={pending ? null : (selected?.id ?? null)}
          poppingId={pending?.id ?? null}
          risenId={finished ? room.winnerId : null}
          inView={phase.revealing ? inView : null}
          onSelect={phase.canSelect && phase.revealing ? onSelect : undefined}
        />
      }
      onLayout={onLayout}
    />
  );
}
