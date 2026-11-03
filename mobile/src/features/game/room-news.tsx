import type { Contestant, Room } from '@/api';
import { PopNews } from '@/features/game/pop-news';
import type { RoomNewsKind } from '@/features/game/room-phase';
import { useT, type Translate } from '@/i18n';

function popLine(t: Translate, room: Room, popped: Contestant) {
  if (room.me.role === 'popper') return t('game.youPopped', { name: popped.name });
  if (popped.id === room.me.id) return t('game.poppedYours', { popper: room.popper.name });
  return t('game.poppedTheirs', { popper: room.popper.name, name: popped.name });
}

function lastBalloonLine(t: Translate, room: Room, keeper: Contestant | undefined) {
  if (!keeper) return undefined;
  return keeper.id === room.me.id
    ? t('game.yourLast')
    : t('game.theirLast', { name: keeper.name });
}

type RoomNewsProps = {
  kind: RoomNewsKind;
  room: Room;
  /** The pop being told. */
  popped: Contestant;
  /** Its seat's color. */
  color: string;
  winner: Contestant | undefined;
  /** Balloons still up, counting a pop on its way. */
  up: Contestant[];
  pending: Contestant | undefined;
  /** The beat is still holding the room. */
  holding: boolean;
  /** The chooser's own pop, which starts at the burst. */
  fromBurst: boolean;
};

/** The top of the page while a pop holds the room: the burst, the line and what is left. */
export function RoomNews({ kind, room, popped, color, winner, up, pending, holding, fromBurst }: RoomNewsProps) {
  const t = useT();
  const isPopper = room.me.role === 'popper';
  if (kind === 'climax') {
    // A match is on its way: keep the last pop on screen until it fades in.
    return (
      <PopNews
        text={popLine(t, room, popped)}
        detail={lastBalloonLine(t, room, winner)}
        color={color}
        animate={holding}
        fromBurst={fromBurst}
        announce={!isPopper}
      />
    );
  }
  const stillUp = up.length - (pending ? 1 : 0);
  const lastOne = pending && stillUp === 1 ? up.find((c) => c.id !== pending.id) : undefined;
  return (
    <PopNews
      text={popLine(t, room, popped)}
      detail={lastOne ? lastBalloonLine(t, room, lastOne) : t('game.balloonsLeft', { count: stillUp })}
      color={color}
      animate
      fromBurst={fromBurst}
      announce={!isPopper}
    />
  );
}
