import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { getProfile, isBlockedEitherWay, personCard } from './lib/people';
import { seatsOf } from './lib/room';
import { schedulePush } from './push';

/** A runner-up can get a second chance this long after the room ends. */
const WINDOW_MS = 7 * 24 * 60 * 60_000;

/** The contestant popped last in a room that ended in a match: the one who almost made it. */
async function runnerUpOf(ctx: QueryCtx, room: Doc<'rooms'>) {
  if (room.status !== 'finished' || !room.winnerId) return null;
  const popped = (await seatsOf(ctx, room._id)).filter((seat) => seat.popped && !seat.left);
  const last = Math.max(0, ...popped.map((seat) => seat.poppedInRound ?? 0));
  return popped.find((seat) => seat.poppedInRound === last) ?? null;
}

async function card(ctx: QueryCtx, userId: Id<'users'>) {
  const person = await personCard(ctx, userId, 1);
  return { id: person.id, name: person.name, age: person.age, photo: person.photos[0] ?? '' };
}

/** Your runner-ups, the second chances you sent, and the ones sent to you: `SecondChance[]`. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const since = Date.now() - WINDOW_MS;
    const out = [];

    const myRooms = await ctx.db
      .query('rooms')
      .withIndex('by_popper', (q) => q.eq('popperId', userId))
      .order('desc')
      .take(20);
    for (const room of myRooms) {
      if ((room.endedAt ?? room.createdAt) < since) continue;
      const runnerUp = await runnerUpOf(ctx, room);
      if (!runnerUp || (await isBlockedEitherWay(ctx, userId, runnerUp.userId))) continue;
      const sent = (
        await ctx.db
          .query('secondChances')
          .withIndex('by_room', (q) => q.eq('roomId', room._id))
          .collect()
      ).find((row) => row.fromId === userId);
      if (sent && sent.status !== 'sent') continue;
      out.push({
        id: (sent?._id as string | undefined) ?? `almost-${room._id}`,
        roomId: room._id as string,
        person: await card(ctx, runnerUp.userId),
        state: sent ? ('sent' as const) : ('almost' as const),
        createdAt: new Date(sent?.createdAt ?? room.endedAt ?? room.createdAt).toISOString(),
      });
    }

    const incoming = await ctx.db
      .query('secondChances')
      .withIndex('by_to', (q) => q.eq('toId', userId))
      .collect();
    for (const row of incoming) {
      if (row.status !== 'sent' || row.createdAt < since) continue;
      if (await isBlockedEitherWay(ctx, userId, row.fromId)) continue;
      out.push({
        id: row._id as string,
        roomId: row.roomId as string,
        person: await card(ctx, row.fromId),
        state: 'incoming' as const,
        createdAt: new Date(row.createdAt).toISOString(),
      });
    }
    return out;
  },
});

/** The chooser gives their room's runner-up a second chance. */
export const send = mutation({
  args: { roomId: v.string(), userId: v.string() },
  handler: async (ctx, { roomId, userId: toUser }) => {
    const userId = await requireUserId(ctx);
    const id = ctx.db.normalizeId('rooms', roomId);
    const room = id ? await ctx.db.get(id) : null;
    if (!room || room.popperId !== userId) fail('Only the chooser can send a second chance.');
    if ((room.endedAt ?? room.createdAt) < Date.now() - WINDOW_MS) fail('That second chance has passed.');
    const runnerUp = await runnerUpOf(ctx, room);
    if (!runnerUp || (runnerUp.userId as string) !== toUser) fail('That person was not your runner-up.');
    if (await isBlockedEitherWay(ctx, userId, runnerUp.userId)) fail("You can't send this one.");
    const existing = await ctx.db
      .query('secondChances')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    if (existing.some((row) => row.fromId === userId)) return;
    await ctx.db.insert('secondChances', {
      roomId: room._id,
      fromId: userId,
      toId: runnerUp.userId,
      status: 'sent',
      createdAt: Date.now(),
    });
    const me = await getProfile(ctx, userId);
    await schedulePush(ctx, [runnerUp.userId], {
      kind: 'newMatch',
      title: 'A second chance',
      body: `${me?.name ?? 'Your chooser'} wants a second chance with you.`,
      data: { type: 'matches' },
    });
  },
});

/** The runner-up says yes (a match) or no. Resolves with the new match's id, or null. */
export const answer = mutation({
  args: { id: v.string(), accept: v.boolean() },
  handler: async (ctx, { id, accept }): Promise<string | null> => {
    const userId = await requireUserId(ctx);
    const rowId = ctx.db.normalizeId('secondChances', id);
    const row = rowId ? await ctx.db.get(rowId) : null;
    if (!row || row.toId !== userId || row.status !== 'sent') fail('That second chance is no longer open.');
    // Same window and blocks as `list`: an expired or blocked one is gone.
    if (row.createdAt < Date.now() - WINDOW_MS) fail('That second chance has passed.');
    if (await isBlockedEitherWay(ctx, userId, row.fromId)) fail('That second chance is no longer open.');
    await ctx.db.patch(row._id, { status: accept ? 'accepted' : 'declined' });
    if (!accept) return null;
    const matchId = await ctx.db.insert('matches', {
      roomId: row.roomId,
      popperId: row.fromId,
      winnerId: row.toId,
      createdAt: Date.now(),
    });
    await schedulePush(ctx, [row.fromId], {
      kind: 'newMatch',
      title: "It's a match",
      body: 'Your second chance said yes. Say hi.',
      data: { type: 'match', matchId },
    });
    return matchId;
  },
});
