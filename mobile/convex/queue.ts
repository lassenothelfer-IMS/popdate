import { getAuthUserId } from '@convex-dev/auth/server';

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { hasBalloon, NO_BALLOONS } from './lib/balloons';
import { fail } from './lib/errors';
import { lobbySize, QUEUE_AWAY_MS, QUEUE_PING_MS, QUEUE_STALE_MS } from './lib/game';
import { activeRoomOf, getProfile, isBlockedEitherWay } from './lib/people';
import { rateLimit } from './lib/rateLimit';
import { createRoom } from './lib/room';

/** How many waiting players matchmaking looks at. Plenty for the test phase. */
const MAX_WAITING = 500;
/** Block lookups one matchmaking run may make in all, and for each lobby it tries to build. */
const BLOCK_LOOKUP_BUDGET = 2000;
const BLOCK_LOOKUPS_PER_LOBBY = 100;

/** Home shows at most this many blurred faces of people in line, and looks at this many rows to find them. */
const MAX_FACES = 6;
const FACES_LOOKED_AT = 12;

/** Whether a waiting row's app checked in within `windowMs`. */
function seenWithin(row: Doc<'queue'>, now: number, windowMs: number) {
  return (row.seenAt ?? row.joinedAt) >= now - windowMs;
}

/**
 * The waiting rows, oldest first, of people still in line: checked in within
 * `QUEUE_AWAY_MS`. Only those within `QUEUE_STALE_MS` can be a room's chooser.
 */
async function waitingPlayers(ctx: QueryCtx) {
  const now = Date.now();
  const rows = await ctx.db
    .query('queue')
    .withIndex('by_room_joined', (q) => q.eq('roomId', undefined))
    .take(MAX_WAITING);
  return rows.filter((row) => seenWithin(row, now, QUEUE_AWAY_MS));
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
    // Up to six of them, only ever as the tiny blurred copy of their first photo.
    const faces: string[] = [];
    for (const row of waiting.slice(0, FACES_LOOKED_AT)) {
      if (faces.length >= MAX_FACES) break;
      const theirs = await getProfile(ctx, row.userId);
      const blur = theirs?.faceBlur;
      if (!theirs || !blur || blur.of !== theirs.photos[0]) continue;
      if (userId && (await isBlockedEitherWay(ctx, userId, row.userId))) continue;
      const url = await ctx.storage.getUrl(blur.file);
      if (url) faces.push(url);
    }
    return {
      faces,
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
    if (!(await hasBalloon(ctx, userId))) fail(NO_BALLOONS);

    const now = Date.now();
    const entry = {
      userId,
      gender: profile.gender,
      wantsToMeet: profile.wantsToMeet,
      joinedAt: now,
      seenAt: now,
      roomId: undefined,
    };
    const mine = await ctx.db
      .query('queue')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (mine) await ctx.db.replace(mine._id, entry);
    else await ctx.db.insert('queue', entry);

    // Matchmaking runs on its own, right after: joins then don't conflict with each
    // other over the whole queue, and Convex retries the matchmaker until it gets through.
    await ctx.scheduler.runAfter(0, internal.queue.matchmake, { joinerId: userId });
  },
});

/**
 * The queue screen checks in every `QUEUE_PING_MS` while you wait. A place nobody
 * checks in on for `QUEUE_STALE_MS` (the app was closed) no longer counts, so an
 * absent player is never put in a room, least of all as its chooser.
 */
export const pingQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const mine = await ctx.db
      .query('queue')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!mine || mine.roomId) return;
    const now = Date.now();
    // At most one write per half interval: every write wakes everyone's queue status.
    if (seenWithin(mine, now, QUEUE_PING_MS / 2)) return;
    const couldChoose = seenWithin(mine, now, QUEUE_STALE_MS);
    await ctx.db.patch(mine._id, { seenAt: now });
    // Back from the background: you can be a chooser again, which may complete a lobby.
    if (!couldChoose) await ctx.scheduler.runAfter(0, internal.queue.matchmake, { joinerId: userId });
  },
});

/** Every minute (`crons.ts`): deletes places in line nobody checked in on for `QUEUE_AWAY_MS`. */
export const sweepStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - QUEUE_AWAY_MS;
    const stale = await ctx.db
      .query('queue')
      .withIndex('by_room_seen', (q) => q.eq('roomId', undefined).lt('seenAt', cutoff))
      .take(200);
    for (const row of stale) await ctx.db.delete(row._id);
    if (stale.length === 200) await ctx.scheduler.runAfter(0, internal.queue.sweepStale, {});
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
 * `joinQueue` schedules it, so a lobby forms right after its last player joins;
 * the one who just joined always counts, even past the oldest `MAX_WAITING`.
 */
export const matchmake = internalMutation({
  args: { joinerId: v.optional(v.id('users')) },
  handler: async (ctx, { joinerId }) => {
    const waiting = await waitingPlayers(ctx);
    if (joinerId && !waiting.some((row) => row.userId === joinerId)) {
      const joiner = await ctx.db
        .query('queue')
        .withIndex('by_user', (q) => q.eq('userId', joinerId))
        .unique();
      if (joiner && !joiner.roomId && seenWithin(joiner, Date.now(), QUEUE_AWAY_MS)) waiting.push(joiner);
    }
    // One room formed: try again, in case the queue holds another.
    if (await formLobby(ctx, waiting)) await ctx.scheduler.runAfter(0, internal.queue.matchmake, {});
  },
});

async function formLobby(ctx: MutationCtx, waiting: Doc<'queue'>[]) {
  const contestantsNeeded = lobbySize() - 1;
  const now = Date.now();
  const blocked = blockCheck(ctx);

  for (const first of waiting) {
    const candidates = waiting.filter((row) => row !== first && fits(first, row));
    // Not enough people who fit: skip without reading a single block.
    if (candidates.length < contestantsNeeded) continue;
    blocked.nextLobby();
    const group = [first];
    let outOfLookups = false;
    for (const candidate of candidates) {
      let clash = false;
      for (const member of group) {
        const result = await blocked.check(member.userId, candidate.userId);
        if (result === null) {
          outOfLookups = true;
          break;
        }
        if (result) {
          clash = true;
          break;
        }
      }
      // This lobby costs too many lookups: try the next one instead of stalling the line.
      if (outOfLookups) break;
      if (clash) continue;
      group.push(candidate);
      if (group.length > contestantsNeeded) break;
    }
    if (blocked.spent()) return false;
    if (outOfLookups || group.length <= contestantsNeeded) continue;

    // Anyone who fits the other five may choose, if they checked in recently: the room
    // waits on its chooser, so someone whose phone is locked can only hold a balloon.
    const choosers = group.filter(
      (member) =>
        seenWithin(member, now, QUEUE_STALE_MS) &&
        group.every((other) => other === member || fits(member, other)),
    );
    if (choosers.length === 0) continue;
    const popper = choosers[Math.floor(Math.random() * choosers.length)];
    const roomId = await createRoom(
      ctx,
      popper.userId,
      group.filter((row) => row !== popper).map((row) => row.userId),
    );
    for (const row of group) await ctx.db.patch(row._id, { roomId });
    return true;
  }
  return false;
}

/**
 * Whether two people blocked each other, either way: two point lookups per pair,
 * cached, so the cost follows the lobbies being built, not anyone's block list.
 * `check` is null once this lobby's allowance or the whole run's budget is spent;
 * the cron's next run starts afresh.
 */
function blockCheck(ctx: QueryCtx) {
  const cache = new Map<string, boolean>();
  let budget = BLOCK_LOOKUP_BUDGET;
  let lobbyAllowance = BLOCK_LOOKUPS_PER_LOBBY;
  return {
    nextLobby() {
      lobbyAllowance = BLOCK_LOOKUPS_PER_LOBBY;
    },
    spent: () => budget <= 0,
    async check(a: Id<'users'>, b: Id<'users'>): Promise<boolean | null> {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const known = cache.get(key);
      if (known !== undefined) return known;
      if (budget <= 0 || lobbyAllowance <= 0) return null;
      budget -= 2;
      lobbyAllowance -= 2;
      const result = await isBlockedEitherWay(ctx, a, b);
      cache.set(key, result);
      return result;
    },
  };
}
