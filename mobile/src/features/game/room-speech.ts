import type { Room } from '@/api';
import { sentence } from '@/features/game/announce';
import { resultLine } from '@/features/game/result-block';
import type { RoomPhase } from '@/features/game/room-phase';
import type { Translate } from '@/i18n';

/**
 * What the room just moved on to, in a sentence, for VoiceOver: the lines on the
 * page that Android reads from their live regions, and the question, which has none.
 * Quiet while a pop holds the room, because PopNews says the pop, and once you
 * are on your way out.
 */
export function spokenPhase(
  t: Translate,
  room: Room,
  phase: RoomPhase,
  { title, leaving, myPhotoLine }: { title: string; leaving: boolean; myPhotoLine: string },
): string | null {
  const { isPopper, winner, me } = phase;
  if (phase.holdingPop || phase.climax || leaving || me?.left) return null;
  const popperName = room.popper.name;
  const question = room.question ? sentence(room.question.text) : '';
  switch (room.status) {
    case 'finished': {
      // The match opens on its own and says what happened.
      if (room.matchId) return null;
      const result = winner
        ? sentence(resultLine(t, phase.viewer, popperName, winner.name))
        : `${sentence(t('game.endedEarly'))} ${t('game.noMatch')}`;
      return phase.ownFinalPop
        ? `${sentence(t('game.poppedYours', { popper: popperName }))} ${result}`
        : result;
    }
    case 'picking':
      return isPopper
        ? `${title}. ${sentence(t('game.askSomething'))}`
        : `${title}. ${sentence(t('game.isPicking', { name: popperName }))}${room.round > 1 ? ` ${sentence(t('game.balloonsLeft', { count: phase.up.length }))}` : ''}`;
    case 'answering':
      return isPopper
        ? `${t('game.youAskedSpoken', { question })} ${t('game.photosUnlock')}`
        : t('game.asksSpoken', { name: popperName, question });
    case 'popping':
      if (isPopper) {
        return room.popReminder
          ? t('game.waitingOnYou')
          : `${t('game.answersIn')} ${sentence(t('game.choosePop'))}`;
      }
      return `${sentence(t('game.isDeciding', { name: popperName }))}${phase.myPhotoShowing ? ` ${myPhotoLine}` : ''}`;
  }
}
