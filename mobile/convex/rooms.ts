import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { MAX_ANSWER_LENGTH, POP_LIMIT_MS } from './lib/game';
import { maskProfanity } from './lib/profanity';
import { rateLimit } from './lib/rateLimit';
import {
  endAnsweringIfEveryoneAnswered,
  leave,
  pop,
  roomView,
  seatsOf,
  startAnswering,
  startPopping,
} from './lib/room';

/** The room as you may see it, live. Null when it doesn't exist or you aren't in it. */
export const get = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    const id = ctx.db.normalizeId('rooms', roomId);
    if (!userId || !id) return null;
    const room = await ctx.db.get(id);
    return room ? await roomView(ctx, room, userId) : null;
  },
});

/** The room you're still playing in: as its popper, or with your balloon still up. */
export const active = query({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const asPopper = await ctx.db
      .query('rooms')
      .withIndex('by_popper', (q) => q.eq('popperId', userId))
      .order('desc')
      .first();
    if (asPopper && asPopper.status !== 'finished') return asPopper._id;
    const seats = await ctx.db
      .query('roomPlayers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(5);
    for (const seat of seats) {
      if (seat.popped || seat.left) continue;
      const room = await ctx.db.get(seat.roomId);
      if (room && room.status !== 'finished') return room._id;
    }
    return null;
  },
});

async function requireRoom(ctx: Parameters<typeof requireUserId>[0], roomId: string) {
  const id = ctx.db.normalizeId('rooms', roomId);
  const room = id ? await ctx.db.get(id) : null;
  if (!room) fail('This room does not exist anymore.');
  return room;
}

export const pickQuestion = mutation({
  args: { roomId: v.string(), questionId: v.string() },
  handler: async (ctx, { roomId, questionId }) => {
    const userId = await requireUserId(ctx);
    const room = await requireRoom(ctx, roomId);
    if (room.popperId !== userId) fail('Only the popper picks the question.');
    if (room.status !== 'picking') fail('The question is already picked.');
    const question = room.questionOptionIds.find((id) => id === questionId);
    if (!question) fail('That question is not one of the options.');
    await startAnswering(ctx, room, question);
  },
});

export const postAnswer = mutation({
  args: { roomId: v.string(), text: v.string() },
  handler: async (ctx, { roomId, text }) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `postAnswer:${userId}`, 10, 60_000);
    const room = await requireRoom(ctx, roomId);
    const seat = (await seatsOf(ctx, room._id)).find((s) => s.userId === userId);
    if (!seat || seat.popped) fail("You can't answer in this round.");
    if (room.status !== 'answering' || Date.now() > (room.deadline ?? 0)) {
      fail('Answer time is over.');
    }
    const existing = await ctx.db
      .query('answers')
      .withIndex('by_room_round', (q) => q.eq('roomId', room._id).eq('round', room.round))
      .collect();
    if (existing.some((answer) => answer.userId === userId)) fail('You already answered.');
    const answer = text.trim();
    if (!answer || answer.length > MAX_ANSWER_LENGTH) {
      fail(`Answers are 1 to ${MAX_ANSWER_LENGTH} characters.`);
    }

    await ctx.db.insert('answers', {
      roomId: room._id,
      userId,
      round: room.round,
      text: maskProfanity(answer),
      createdAt: Date.now(),
    });
    await endAnsweringIfEveryoneAnswered(ctx, room._id);
  },
});

export const popBalloon = mutation({
  args: { roomId: v.string(), contestantId: v.string() },
  handler: async (ctx, { roomId, contestantId }) => {
    const userId = await requireUserId(ctx);
    const room = await requireRoom(ctx, roomId);
    if (room.popperId !== userId) fail('Only the popper can pop.');
    if (room.status !== 'popping') fail("It's not time to pop yet.");
    const seat = (await seatsOf(ctx, room._id)).find((s) => s.userId === contestantId);
    if (!seat || seat.popped) fail('That balloon is already popped.');
    await pop(ctx, room, seat);
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const id = ctx.db.normalizeId('rooms', roomId);
    const room = id ? await ctx.db.get(id) : null;
    if (room) await leave(ctx, room, userId);
  },
});

/** The 60-second answer timer. Does nothing if the round already moved on. */
export const answerTimeUp = internalMutation({
  args: { roomId: v.id('rooms'), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const room = await ctx.db.get(roomId);
    if (room?.status === 'answering' && room.round === round) await startPopping(ctx, room);
  },
});

/** The pick timer: an idle popper gets one of the options picked for them. */
export const pickTimeUp = internalMutation({
  args: { roomId: v.id('rooms'), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const room = await ctx.db.get(roomId);
    if (room?.status !== 'picking' || room.round !== round) return;
    const options = room.questionOptionIds;
    if (options.length === 0) return;
    await startAnswering(ctx, room, options[Math.floor(Math.random() * options.length)]);
  },
});

/** The 30-second pop timer: it reminds the popper, and starts the last 30 seconds. */
export const popTimeUp = internalMutation({
  args: { roomId: v.id('rooms'), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const room = await ctx.db.get(roomId);
    if (room?.status !== 'popping' || room.round !== round) return;
    const deadline = Date.now() + POP_LIMIT_MS;
    await ctx.db.patch(roomId, { popReminder: true, deadline });
    await ctx.scheduler.runAt(deadline, internal.rooms.popLimitUp, { roomId, round });
  },
});

/** Past the pop limit a random balloon pops, so five people never wait forever. */
export const popLimitUp = internalMutation({
  args: { roomId: v.id('rooms'), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const room = await ctx.db.get(roomId);
    if (room?.status !== 'popping' || room.round !== round) return;
    const stillIn = (await seatsOf(ctx, roomId)).filter((seat) => !seat.popped);
    if (stillIn.length === 0) return;
    await pop(ctx, room, stillIn[Math.floor(Math.random() * stillIn.length)]);
  },
});
