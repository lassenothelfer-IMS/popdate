import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalAction, internalMutation } from './_generated/server';
import { gender } from './schema';

/*
 * Dev only: extra players so you can fill a room alone. Internal, so only the
 * team can run it (CLI or dashboard), and only on a deployment that sets
 * ALLOW_TEST_PLAYERS=true, because a test player looks exactly like a real person.
 *
 *   npx convex env set ALLOW_TEST_PLAYERS true
 *   npx convex run testPlayers:add '{"count": 2, "gender": "man", "wantsToMeet": "woman"}'
 *   npx convex run --identity '{"subject": "<id>|cli"}' queue:joinQueue
 */

/** A 1×1 PNG, so test profiles have six real photo files. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function requireTestDeployment() {
  if (process.env.ALLOW_TEST_PLAYERS !== 'true') {
    throw new Error('Test players are off. Set ALLOW_TEST_PLAYERS=true on a dev deployment.');
  }
}

export const add = internalAction({
  args: { count: v.number(), gender, wantsToMeet: gender },
  handler: async (ctx, { count, gender, wantsToMeet }): Promise<string[]> => {
    requireTestDeployment();
    const bytes = Uint8Array.from(atob(PIXEL_PNG), (char) => char.charCodeAt(0));
    const ids: string[] = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      const photos: Id<'_storage'>[] = [];
      for (let p = 0; p < 6; p++) {
        photos.push(await ctx.storage.store(new Blob([bytes], { type: 'image/png' })));
      }
      ids.push(
        await ctx.runMutation(internal.testPlayers.insert, {
          name: `Test ${gender === 'woman' ? 'Woman' : 'Man'} ${i + 1}`,
          gender,
          wantsToMeet,
          photos,
        }),
      );
    }
    return ids;
  },
});

export const insert = internalMutation({
  args: { name: v.string(), gender, wantsToMeet: gender, photos: v.array(v.id('_storage')) },
  handler: async (ctx, { name, gender, wantsToMeet, photos }) => {
    requireTestDeployment();
    const userId = await ctx.db.insert('users', { isAnonymous: true });
    for (const storageId of photos) await ctx.db.insert('uploads', { storageId, ownerId: userId });
    await ctx.db.insert('profiles', {
      userId,
      name,
      birthDate: '1998-06-15',
      gender,
      wantsToMeet,
      city: 'Zurich',
      heightCm: 178,
      job: 'Tester',
      bio: 'A test player.',
      photos,
      termsAcceptedAt: new Date().toISOString(),
    });
    return userId as string;
  },
});
