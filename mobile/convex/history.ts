import { getAuthUserId } from '@convex-dev/auth/server';

import type { Doc, Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { getProfile, isBlockedEitherWay } from './lib/people';

/** How many past rooms the history shows. */
const HISTORY_LIMIT = 50;

/** One finished room from your side: the `RoomSummary` shape in `src/api/types.ts`. */
async function summary(
  ctx: QueryCtx,
  room: Doc<'rooms'>,
  userId: Id<'users'>,
  seat: Doc<'roomPlayers'> | undefined,
) {
  const iAmPopper = room.popperId === userId;
  const iWon = !iAmPopper && room.winnerId === userId;
  // The match belongs to the popper and the winner, as in `ownsMatch`; it's gone once they unmatch.
  const match = (iAmPopper || iWon) && room.matchId ? await ctx.db.get(room.matchId) : null;
  const otherId = match ? (match.popperId === userId ? match.winnerId : match.popperId) : null;
  // A block, either way, hides the match here as in Matches, until it's lifted.
  const hidden = otherId ? await isBlockedEitherWay(ctx, userId, otherId) : false;
  const [popper, other] = await Promise.all([
    getProfile(ctx, room.popperId),
    otherId && !hidden ? getProfile(ctx, otherId) : null,
  ]);
  const rounds = await Promise.all(
    room.usedQuestionIds.map(async (questionId, index) => {
      const question = await ctx.db.get(questionId);
      const answers = await ctx.db
        .query('answers')
        .withIndex('by_room_round', (q) => q.eq('roomId', room._id).eq('round', index + 1))
        .collect();
      const mine = answers.find((answer) => answer.userId === userId);
      return { question: question?.text ?? '', answer: mine?.text ?? null };
    }),
  );
  /*
   * The chooser "chose" when the room ended with a winner (unmatching later doesn't
   * change that), else they "left". A contestant "won", "left" while still holding a
   * balloon, or was "popped" in their round, even if they left after the pop. When
   * the room ended without a winner while they were still in (the chooser left),
   * they count as popped in the round the room stopped in, never in no round.
   */
  const outcome = iAmPopper
    ? room.winnerId
      ? ('chose' as const)
      : ('left' as const)
    : iWon
      ? ('won' as const)
      : seat?.leftInRound !== undefined
        ? ('left' as const)
        : ('popped' as const);
  const poppedInRound =
    iAmPopper || iWon ? null : (seat?.leftInRound ?? seat?.poppedInRound ?? room.round);
  return {
    roomId: room._id as string,
    endedAt: new Date(room.endedAt ?? room.createdAt).toISOString(),
    role: iAmPopper ? ('popper' as const) : ('contestant' as const),
    outcome,
    poppedInRound,
    totalRounds: room.totalRounds,
    popperName: popper?.name ?? 'Someone',
    matchName: match && !hidden && match.popperId !== match.winnerId ? (other?.name ?? 'Someone') : null,
    matchId: match && !hidden ? (match._id as string) : null,
    rounds,
  };
}

/** The rooms you played, as chooser or with a balloon, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const [asPopper, seats] = await Promise.all([
      ctx.db
        .query('rooms')
        .withIndex('by_popper', (q) => q.eq('popperId', userId))
        .order('desc')
        .take(HISTORY_LIMIT),
      ctx.db
        .query('roomPlayers')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('desc')
        .take(HISTORY_LIMIT),
    ]);
    const rooms = new Map(asPopper.map((room) => [room._id, room]));
    for (const seat of seats) {
      const room = await ctx.db.get(seat.roomId);
      if (room) rooms.set(room._id, room);
    }
    const finished = [...rooms.values()]
      .filter((room) => room.status === 'finished')
      .sort((a, b) => (b.endedAt ?? b.createdAt) - (a.endedAt ?? a.createdAt))
      .slice(0, HISTORY_LIMIT);
    return await Promise.all(
      finished.map((room) =>
        summary(
          ctx,
          room,
          userId,
          seats.find((seat) => seat.roomId === room._id),
        ),
      ),
    );
  },
});
