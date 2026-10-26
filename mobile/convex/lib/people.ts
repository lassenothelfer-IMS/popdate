import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { ageFromBirthDate } from '../../src/utils/birth-date';

export { ageFromBirthDate };

export async function getProfile(ctx: QueryCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

/** The first `count` photos as URLs. A missing file reads as an empty string. */
export async function photoUrls(ctx: QueryCtx, photos: Id<'_storage'>[], count = photos.length) {
  return await Promise.all(
    photos.slice(0, count).map(async (id) => (await ctx.storage.getUrl(id)) ?? ''),
  );
}

/** Name, age and photos to show for someone, even if their account is gone. */
export async function personCard(ctx: QueryCtx, userId: Id<'users'>, photoCount: number) {
  const profile = await getProfile(ctx, userId);
  if (!profile) return { id: userId as string, name: 'Someone', age: 0, photos: [] as string[] };
  return {
    id: userId as string,
    name: profile.name,
    age: ageFromBirthDate(profile.birthDate),
    photos: await photoUrls(ctx, profile.photos, photoCount),
  };
}

export async function isBlockedEitherWay(ctx: QueryCtx, a: Id<'users'>, b: Id<'users'>) {
  for (const [blockerId, blockedId] of [
    [a, b],
    [b, a],
  ]) {
    const row = await ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) => q.eq('blockerId', blockerId).eq('blockedId', blockedId))
      .first();
    if (row) return true;
  }
  return false;
}

/** The room a player is still playing in: as the popper, or as a contestant still holding a balloon. */
export async function activeRoomOf(ctx: QueryCtx, userId: Id<'users'>): Promise<Doc<'rooms'> | null> {
  const asPopper = await ctx.db
    .query('rooms')
    .withIndex('by_popper', (q) => q.eq('popperId', userId))
    .order('desc')
    .first();
  if (asPopper && asPopper.status !== 'finished') return asPopper;

  const seats = await ctx.db
    .query('roomPlayers')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .order('desc')
    .take(20);
  for (const seat of seats) {
    if (seat.popped || seat.left) continue;
    const room = await ctx.db.get(seat.roomId);
    if (room && room.status !== 'finished') return room;
  }
  return null;
}
