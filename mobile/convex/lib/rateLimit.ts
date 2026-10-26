import type { MutationCtx } from '../_generated/server';
import { fail } from './errors';

/**
 * Allows `max` calls per `windowMs` for one key, for example `sendMessage:<userId>`.
 * Anonymous accounts are free to make, so anything a script could flood is limited.
 */
export async function rateLimit(ctx: MutationCtx, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row = await ctx.db
    .query('rateLimits')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique();

  if (!row) {
    await ctx.db.insert('rateLimits', { key, windowStart: now, count: 1 });
    return;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return;
  }
  if (row.count >= max) fail('Slow down a little and try again in a moment.');
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
