import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { ANSWER_MS, POP_REMINDER_MS, QUESTION_OPTIONS_PER_ROUND, shuffle } from './game';
import { ageFromBirthDate, getProfile, personCard, photoUrls } from './people';
import { questionPool } from './questions';

/*
 * The game rules, following the mock in `src/api/mock-server.ts` so the screens
 * behave the same against both. Every change re-reads the room inside its
 * mutation; Convex runs mutations as serializable transactions, so two pops
 * sent at once can never both land.
 */

export async function seatsOf(ctx: QueryCtx, roomId: Id<'rooms'>) {
  const seats = await ctx.db
    .query('roomPlayers')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  return seats.sort((a, b) => a.seat - b.seat);
}

function stillIn(seat: Doc<'roomPlayers'>) {
  return !seat.popped;
}

/** Opens a room for a popper and their contestants, and starts round 1. */
export async function createRoom(
  ctx: MutationCtx,
  popperId: Id<'users'>,
  contestantIds: Id<'users'>[],
) {
  const roomId = await ctx.db.insert('rooms', {
    status: 'picking',
    round: 1,
    totalRounds: contestantIds.length - 1,
    popperId,
    questionOptionIds: [],
    usedQuestionIds: [],
    popReminder: false,
    createdAt: Date.now(),
  });
  for (const [seat, userId] of shuffle(contestantIds).entries()) {
    await ctx.db.insert('roomPlayers', { roomId, userId, seat, popped: false, left: false });
  }
  await startRound(ctx, roomId);
  return roomId;
}

async function startRound(ctx: MutationCtx, roomId: Id<'rooms'>) {
  const room = (await ctx.db.get(roomId))!;
  const unused = (await questionPool(ctx)).filter(
    (question) => !room.usedQuestionIds.includes(question._id),
  );
  await ctx.db.patch(roomId, {
    status: 'picking',
    questionId: undefined,
    questionOptionIds: shuffle(unused)
      .slice(0, QUESTION_OPTIONS_PER_ROUND)
      .map((question) => question._id),
    deadline: undefined,
    popReminder: false,
  });
}

export async function startAnswering(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  questionId: Id<'questions'>,
) {
  const deadline = Date.now() + ANSWER_MS;
  await ctx.db.patch(room._id, {
    status: 'answering',
    questionId,
    questionOptionIds: [],
    usedQuestionIds: [...room.usedQuestionIds, questionId],
    deadline,
  });
  await ctx.scheduler.runAt(deadline, internal.rooms.answerTimeUp, {
    roomId: room._id,
    round: room.round,
  });
}

export async function startPopping(ctx: MutationCtx, room: Doc<'rooms'>) {
  const deadline = Date.now() + POP_REMINDER_MS;
  await ctx.db.patch(room._id, { status: 'popping', deadline, popReminder: false });
  await ctx.scheduler.runAt(deadline, internal.rooms.popTimeUp, {
    roomId: room._id,
    round: room.round,
  });
}

/** Moves on to popping as soon as every contestant still in has answered. */
export async function endAnsweringIfEveryoneAnswered(ctx: MutationCtx, roomId: Id<'rooms'>) {
  const room = (await ctx.db.get(roomId))!;
  if (room.status !== 'answering') return;
  const answers = await ctx.db
    .query('answers')
    .withIndex('by_room_round', (q) => q.eq('roomId', roomId).eq('round', room.round))
    .collect();
  const answered = new Set(answers.map((answer) => answer.userId));
  const waiting = (await seatsOf(ctx, roomId)).filter(
    (seat) => stillIn(seat) && !answered.has(seat.userId),
  );
  if (waiting.length === 0) await startPopping(ctx, room);
}

/** Pops one contestant: the next round starts, or the last balloon left wins. */
export async function pop(ctx: MutationCtx, room: Doc<'rooms'>, seat: Doc<'roomPlayers'>) {
  await ctx.db.patch(seat._id, { popped: true, poppedInRound: room.round });
  const seats = await seatsOf(ctx, room._id);
  if (seats.filter(stillIn).length <= 1) {
    await finish(ctx, room._id);
    return;
  }
  await ctx.db.patch(room._id, { round: room.round + 1 });
  await startRound(ctx, room._id);
}

/** Ends the room. With one balloon left, that contestant and the popper become a match. */
export async function finish(ctx: MutationCtx, roomId: Id<'rooms'>, { withWinner = true } = {}) {
  const room = (await ctx.db.get(roomId))!;
  const winner = withWinner ? (await seatsOf(ctx, roomId)).find(stillIn) : undefined;
  let matchId: Id<'matches'> | undefined;
  if (winner) {
    matchId = await ctx.db.insert('matches', {
      roomId,
      popperId: room.popperId,
      winnerId: winner.userId,
      createdAt: Date.now(),
    });
  }
  await ctx.db.patch(roomId, {
    status: 'finished',
    deadline: undefined,
    popReminder: false,
    winnerId: winner?.userId,
    matchId,
  });
}

/**
 * A player leaves. Without a popper the room can't go on; a contestant who leaves
 * mid-game counts as popped, and the round goes on.
 */
export async function leave(ctx: MutationCtx, room: Doc<'rooms'>, userId: Id<'users'>) {
  if (room.status === 'finished') return;

  if (room.popperId === userId) {
    await finish(ctx, room._id, { withWinner: false });
    return;
  }

  const seat = (await seatsOf(ctx, room._id)).find((s) => s.userId === userId);
  if (!seat) return;
  if (!stillIn(seat)) {
    await ctx.db.patch(seat._id, { left: true });
    return;
  }
  await ctx.db.patch(seat._id, { left: true, popped: true, poppedInRound: room.round });
  const seats = await seatsOf(ctx, room._id);
  if (seats.filter(stillIn).length <= 1) {
    await finish(ctx, room._id);
    return;
  }
  await endAnsweringIfEveryoneAnswered(ctx, room._id);
}

/** What one player is allowed to see of a room: the `Room` shape in `src/api/types.ts`. */
export async function roomView(ctx: QueryCtx, room: Doc<'rooms'>, viewerId: Id<'users'>) {
  const seats = await seatsOf(ctx, room._id);
  const isPopper = room.popperId === viewerId;
  if (!isPopper && !seats.some((seat) => seat.userId === viewerId)) return null;
  const role = isPopper ? ('popper' as const) : ('contestant' as const);

  // Photo N unlocks once round N's answers are in.
  const revealed =
    room.status === 'picking' || room.status === 'answering' ? room.round - 1 : room.round;
  const answers = await ctx.db
    .query('answers')
    .withIndex('by_room_round', (q) => q.eq('roomId', room._id).eq('round', room.round))
    .collect();
  const answerOf = new Map(answers.map((answer) => [answer.userId, answer.text]));

  const contestants = await Promise.all(
    seats.map(async (seat) => {
      const photoCount = seat.popped ? Math.min(revealed, seat.poppedInRound ?? 0) : revealed;
      const profile = await getProfile(ctx, seat.userId);
      // While answering, only the popper sees answers as they come in.
      const answerVisible = isPopper || room.status !== 'answering' || seat.userId === viewerId;
      return {
        id: seat.userId as string,
        name: profile?.name ?? 'Someone',
        age: profile ? ageFromBirthDate(profile.birthDate) : 0,
        photos: profile ? await photoUrls(ctx, profile.photos, photoCount) : [],
        popped: seat.popped,
        poppedInRound: seat.poppedInRound ?? null,
        left: seat.left,
        answered: answerOf.has(seat.userId),
        answer: answerVisible ? (answerOf.get(seat.userId) ?? null) : null,
      };
    }),
  );

  const question = room.questionId ? await ctx.db.get(room.questionId) : null;
  // Only the popper sees the options, and only while picking.
  const options =
    isPopper && room.status === 'picking'
      ? await Promise.all(room.questionOptionIds.map((id) => ctx.db.get(id)))
      : [];
  // The match belongs to the popper and the winner; nobody else gets its id.
  const ownsMatch = isPopper || room.winnerId === viewerId;

  return {
    id: room._id as string,
    status: room.status,
    round: room.round,
    totalRounds: room.totalRounds,
    popper: await personCard(ctx, room.popperId, 1),
    contestants,
    question: question ? { id: question._id as string, text: question.text } : null,
    questionOptions: options.flatMap((option) =>
      option ? [{ id: option._id as string, text: option.text }] : [],
    ),
    deadline: room.deadline ?? null,
    popReminder: room.popReminder,
    winnerId: (room.winnerId as string | undefined) ?? null,
    matchId: ownsMatch ? ((room.matchId as string | undefined) ?? null) : null,
    me: { id: viewerId as string, role },
  };
}
