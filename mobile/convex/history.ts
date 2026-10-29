import { getAuthUserId } from '@convex-dev/auth/server';

import type { Doc, Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { getProfile } from './lib/people';

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
  const match = room.matchId ? await ctx.db.get(room.matchId) : null;
  const otherId = match ? (match.popperId === userId ? match.winnerId : match.popperId) : null;
  const [popper, other] = await Promise.all([
    getProfile(ctx, room.popperId),
    otherId ? getProfile(ctx, otherId) : null,
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
  const outcome = iAmPopper
    ? match
      ? ('chose' as const)
      : ('left' as const)
    : seat?.left
      ? ('left' as const)
      : room.winnerId === userId
        ? ('won' as const)
        : ('popped' as const);
  return {
    roomId: room._id as string,
    endedAt: new Date(room.endedAt ?? room.createdAt).toISOString(),
    role: iAmPopper ? ('popper' as const) : ('contestant' as const),
    outcome,
    poppedInRound: seat?.poppedInRound ?? null,
    totalRounds: room.totalRounds,
    popperName: popper?.name ?? 'Someone',
    matchName: match && match.popperId !== match.winnerId ? (other?.name ?? 'Someone') : null,
    matchId: (match?._id as string | undefined) ?? null,
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
