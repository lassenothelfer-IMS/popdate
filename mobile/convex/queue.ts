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

/** Who's queuing right now, for Home: the `QueueStats` shape in `src/api/types.ts`. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const profile = userId ? await getProfile(ctx, userId) : null;
    const waiting = (await waitingPlayers(ctx)).filter(
      (row) =>
        row.userId !== userId &&
        (!profile ||
          (wants({ wantsToMeet: profile.wantsToMeet }, row.gender) && wants(row, profile.gender))),
    );
    const hourAgo = Date.now() - 60 * 60_000;
    const recent = await ctx.db.query('rooms').order('desc').take(200);
    return {
      waiting: waiting.length,
      roomsLastHour: recent.filter((room) => room.createdAt > hourAgo).length,
    };
  },
});

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

    const needed = lobbySize();
    const others = (await waitingPlayers(ctx)).filter((row) => row.userId !== userId);
    return { state: 'searching' as const, found: roomReach(mine, others, needed), needed };
  },
});

/**
 * How many people, you included, could share a room with you right now under
 * matchmaking's rules (blocks aside), capped at `needed`. Either you choose and
 * everyone who fits you counts, or a chooser who fits you does, with everyone
 * else who fits them. Fit depends only on side and wish, so each kind of chooser
 * is counted once and the live query stays cheap.
 */
function roomReach(mine: Doc<'queue'>, others: Doc<'queue'>[], needed: number) {
  let best = 1 + others.filter((row) => fits(mine, row)).length;
  const tried = new Set<string>();
  for (const popper of others) {
    if (best >= needed) break;
    const kind = `${popper.gender}|${popper.wantsToMeet}`;
    if (tried.has(kind) || !fits(mine, popper)) continue;
    tried.add(kind);
    const rest = others.filter((row) => row !== popper && fits(popper, row)).length;
    best = Math.max(best, 2 + rest);
  }
  return Math.min(needed, best);
}

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

/** Resolves with the room id when a room already formed with you in it, else null. */
export const leaveQueue = mutation({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const userId = await requireUserId(ctx);
    return await removeFromQueue(ctx, userId);
  },
});

/**
 * Takes you out of the queue. Once matchmaking seated you it's too late: your row
 * stays and you get the room's id back, so the room doesn't run on without you.
 */
export async function removeFromQueue(ctx: MutationCtx, userId: Id<'users'>) {
  const mine = await ctx.db
    .query('queue')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (!mine) return null;
  // A row left over from a room that already ended doesn't count.
  const room = mine.roomId ? await ctx.db.get(mine.roomId) : null;
  if (room && room.status !== 'finished') return room._id as string;
  await ctx.db.delete(mine._id);
  return null;
}

/** Deletes your queue row, even one already matched into a room. For signing out. */
export async function dropQueueRow(ctx: MutationCtx, userId: Id<'users'>) {
  const mine = await ctx.db
    .query('queue')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (mine) await ctx.db.delete(mine._id);
}

/** Whether someone in the queue wants to meet people of this side. */
function wants(row: Pick<Doc<'queue'>, 'wantsToMeet'>, side: Doc<'queue'>['gender']) {
  return row.wantsToMeet === 'everyone' || row.wantsToMeet === side;
}

/** Whether two people in the queue want to meet each other's side. */
function fits(a: Doc<'queue'>, b: Doc<'queue'>) {
  return wants(a, b.gender) && wants(b, a.gender);
}

/**
 * Builds one lobby if the queue allows it: a popper and `lobbySize() - 1`
 * contestants who all want to meet each other's side, and where nobody has
 * blocked anyone else in the lobby. The longest-waiting players go first; then
 * the popper is drawn at random from everyone in the lobby who fits all the others.
 * It runs inside `joinQueue`, so a lobby forms the moment its last player joins.
 */
async function matchmake(ctx: MutationCtx) {
  const contestantsNeeded = lobbySize() - 1;
  const waiting = await waitingPlayers(ctx);
  const blocksOf = blockLookup(ctx);

  for (const first of waiting) {
    const group = [first];
    const clashing = new Set(await blocksOf(first.userId));
    for (const candidate of waiting) {
      if (candidate.userId === first.userId) continue;
      if (!fits(first, candidate) || clashing.has(candidate.userId)) continue;
      group.push(candidate);
      for (const id of await blocksOf(candidate.userId)) clashing.add(id);
      if (group.length > contestantsNeeded) break;
    }
    if (group.length <= contestantsNeeded) continue;

    // `first` always qualifies; anyone else who fits the other five may choose too.
    const choosers = group.filter((member) =>
      group.every((other) => other === member || fits(member, other)),
    );
    const popper = choosers[Math.floor(Math.random() * choosers.length)];
    const roomId = await createRoom(
      ctx,
      popper.userId,
      group.filter((row) => row !== popper).map((row) => row.userId),
    );
    for (const row of group) await ctx.db.patch(row._id, { roomId });
    return;
  }
}

/**
 * Who someone blocked or was blocked by, loaded once per person and only for the
 * people matchmaking puts in a lobby, not for the whole queue.
 */
function blockLookup(ctx: QueryCtx) {
  const cache = new Map<Id<'users'>, Id<'users'>[]>();
  return async (userId: Id<'users'>) => {
    const known = cache.get(userId);
    if (known) return known;
    const [mine, theirs] = await Promise.all([
      ctx.db
        .query('blocks')
        .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
        .collect(),
      ctx.db
        .query('blocks')
        .withIndex('by_blocked', (q) => q.eq('blockedId', userId))
        .collect(),
    ]);
    const ids = [...mine.map((row) => row.blockedId), ...theirs.map((row) => row.blockerId)];
    cache.set(userId, ids);
    return ids;
  };
}
