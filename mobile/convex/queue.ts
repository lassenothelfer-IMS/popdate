import { getAuthUserId } from '@convex-dev/auth/server';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { lobbySize } from './lib/game';
import { activeRoomOf, getProfile } from './lib/people';
import { rateLimit } from './lib/rateLimit';
import { createRoom } from './lib/room';

/** How many waiting players matchmaking looks at. Plenty for the test phase. */
const MAX_WAITING = 500;

async function waitingPlayers(ctx: QueryCtx) {
  return await ctx.db
    .query('queue')
    .withIndex('by_room_joined', (q) => q.eq('roomId', undefined))
    .take(MAX_WAITING);
}

/** Your place in the queue, live: the `QueueStatus` shape in `src/api/types.ts`. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const mine = userId
      ? await ctx.db
          .query('queue')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .unique()
      : null;
    if (!mine) return { state: 'idle' as const };
    if (mine.roomId) return { state: 'matched' as const, roomId: mine.roomId as string };

    // Everyone who could end up in a lobby with you: your side and the side you want to meet.
    const needed = lobbySize();
    const others = (await waitingPlayers(ctx)).filter(
      (row) =>
        row.userId !== userId &&
        ((row.gender === mine.gender && row.wantsToMeet === mine.wantsToMeet) ||
          (row.gender === mine.wantsToMeet && row.wantsToMeet === mine.gender)),
    );
    return { state: 'searching' as const, found: Math.min(needed, 1 + others.length), needed };
  },
});

export const joinQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `joinQueue:${userId}`, 20, 60_000);
    const profile = await getProfile(ctx, userId);
    if (!profile) fail('Finish your profile before you play.');
    if (await activeRoomOf(ctx, userId)) fail("You're still in a room.");

    const entry = {
      userId,
      gender: profile.gender,
      wantsToMeet: profile.wantsToMeet,
      joinedAt: Date.now(),
      roomId: undefined,
    };
    const mine = await ctx.db
      .query('queue')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (mine) await ctx.db.replace(mine._id, entry);
    else await ctx.db.insert('queue', entry);

    await matchmake(ctx);
  },
});

export const leaveQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await removeFromQueue(ctx, userId);
  },
});

export async function removeFromQueue(ctx: MutationCtx, userId: Id<'users'>) {
  const mine = await ctx.db
    .query('queue')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (mine) await ctx.db.delete(mine._id);
}

/**
 * Builds one lobby if the queue allows it: a popper and `lobbySize() - 1`
 * contestants who all want to meet each other's side, and where nobody has
 * blocked anyone else in the lobby. The longest-waiting players go first.
 * It runs inside `joinQueue`, so a lobby forms the moment its last player joins.
 */
async function matchmake(ctx: MutationCtx) {
  const contestantsNeeded = lobbySize() - 1;
  const waiting = await waitingPlayers(ctx);
  const clashes = await blockedPairs(ctx, waiting);
  const clash = (a: Id<'users'>, b: Id<'users'>) => clashes.has(`${a}|${b}`);

  for (const popper of waiting) {
    const picked: Doc<'queue'>[] = [];
    for (const candidate of waiting) {
      if (candidate.userId === popper.userId) continue;
      if (candidate.gender !== popper.wantsToMeet || candidate.wantsToMeet !== popper.gender) {
        continue;
      }
      if ([popper, ...picked].some((member) => clash(member.userId, candidate.userId))) continue;
      picked.push(candidate);
      if (picked.length === contestantsNeeded) break;
    }
    if (picked.length < contestantsNeeded) continue;

    const roomId = await createRoom(
      ctx,
      popper.userId,
      picked.map((row) => row.userId),
    );
    for (const row of [popper, ...picked]) await ctx.db.patch(row._id, { roomId });
    return;
  }
}

/** Every blocked pair among the waiting players, stored in both directions. */
async function blockedPairs(ctx: QueryCtx, waiting: Doc<'queue'>[]) {
  const ids = new Set<string>(waiting.map((row) => row.userId));
  const pairs = new Set<string>();
  for (const row of waiting) {
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', row.userId))
      .collect();
    for (const block of blocks) {
      if (!ids.has(block.blockedId)) continue;
      pairs.add(`${block.blockerId}|${block.blockedId}`);
      pairs.add(`${block.blockedId}|${block.blockerId}`);
    }
  }
  return pairs;
}
