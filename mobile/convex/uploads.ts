import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

/** An upload nobody claimed within this long was abandoned (a removed pick, a sign-up given up). */
const UNCLAIMED_GRACE_MS = 24 * 60 * 60_000;
/** Files looked at per run. */
const BATCH = 200;

/**
 * Hourly (`crons.ts`): deletes uploaded files nobody ever claimed. Photos and
 * selfies go to storage before a profile or selfie is saved, and only saving
 * records an owner (`uploads`), so abandoned uploads would otherwise stay forever.
 * Every file in use has an `uploads` row. Walks storage oldest first and remembers
 * how far it got, so each run only looks at new files.
 */
export const sweepUnclaimed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query('uploadSweep').first();
    const after = state?.after ?? 0;
    const before = Date.now() - UNCLAIMED_GRACE_MS;
    const files = await ctx.db.system
      .query('_storage')
      .withIndex('by_creation_time', (q) => q.gt('_creationTime', after).lt('_creationTime', before))
      .take(BATCH);
    for (const file of files) {
      const owner = await ctx.db
        .query('uploads')
        .withIndex('by_storage', (q) => q.eq('storageId', file._id))
        .unique();
      if (!owner) await ctx.storage.delete(file._id);
    }
    const last = files.at(-1)?._creationTime;
    if (last === undefined) return;
    if (state) await ctx.db.patch(state._id, { after: last });
    else await ctx.db.insert('uploadSweep', { after: last });
    if (files.length === BATCH) await ctx.scheduler.runAfter(0, internal.uploads.sweepUnclaimed, {});
  },
});
