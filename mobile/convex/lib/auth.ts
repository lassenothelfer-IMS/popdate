import { getAuthUserId } from '@convex-dev/auth/server';

import type { QueryCtx } from '../_generated/server';
import { fail } from './errors';

/**
 * The signed-in player. Every function that changes player data starts here.
 * The token alone isn't enough: after "Delete account" it stays valid until it
 * expires, so the account itself must still exist.
 */
export async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await ctx.db.get(userId))) fail('Sign in first.');
  return userId;
}
