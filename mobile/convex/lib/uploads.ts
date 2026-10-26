import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { fail } from './errors';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Checks an uploaded file is an image of a sane size and records who uploaded it.
 * The first player to use an upload owns it; nobody else can put it on their profile.
 */
export async function claimImage(ctx: MutationCtx, userId: Id<'users'>, storageId: Id<'_storage'>) {
  const file = await ctx.db.system.get(storageId);
  if (!file) fail('A photo did not upload. Try again.');
  if (!file.contentType || !IMAGE_TYPES.has(file.contentType)) {
    fail('Photos must be JPEG, PNG, WebP or HEIC images.');
  }
  if (file.size > MAX_IMAGE_BYTES) fail('That photo is too large.');

  const owner = await ctx.db
    .query('uploads')
    .withIndex('by_storage', (q) => q.eq('storageId', storageId))
    .unique();
  if (owner && owner.ownerId !== userId) fail('A photo did not upload. Try again.');
  if (!owner) await ctx.db.insert('uploads', { storageId, ownerId: userId });
}

/** Deletes a file and its ownership record. */
export async function deleteImage(ctx: MutationCtx, storageId: Id<'_storage'>) {
  const owner = await ctx.db
    .query('uploads')
    .withIndex('by_storage', (q) => q.eq('storageId', storageId))
    .unique();
  if (owner) await ctx.db.delete(owner._id);
  if (await ctx.db.system.get(storageId)) await ctx.storage.delete(storageId);
}
