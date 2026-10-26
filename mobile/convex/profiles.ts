import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { ageFromBirthDate, getProfile, photoUrls } from './lib/people';
import { rateLimit } from './lib/rateLimit';
import { claimImage, deleteImage } from './lib/uploads';
import { gender } from './schema';

/**
 * Your profile in the `Profile` shape, plus `photoIds`: the app keeps those to
 * resend unchanged photos when you edit your profile, instead of uploading them again.
 */
async function profileView(ctx: QueryCtx, profile: Doc<'profiles'>) {
  return {
    id: profile.userId as string,
    name: profile.name,
    birthDate: profile.birthDate,
    gender: profile.gender,
    wantsToMeet: profile.wantsToMeet,
    city: profile.city,
    heightCm: profile.heightCm,
    job: profile.job,
    bio: profile.bio,
    photos: await photoUrls(ctx, profile.photos),
    photoIds: profile.photos as string[],
    termsAcceptedAt: profile.termsAcceptedAt,
  };
}

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const profile = userId ? await getProfile(ctx, userId) : null;
    return profile ? await profileView(ctx, profile) : null;
  },
});

/** A short upload URL for one photo. The app posts the file there, then saves the returned id. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `upload:${userId}`, 60, 60 * 60_000);
    return await ctx.storage.generateUploadUrl();
  },
});

function text(value: string, label: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed) fail(`Add your ${label}.`);
  if (trimmed.length > max) fail(`Your ${label} is too long.`);
  return trimmed;
}

function checkBirthDate(birthDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const [y, m, d] = match ? match.slice(1).map(Number) : [];
  const date = match ? new Date(Date.UTC(y, m - 1, d)) : null;
  const real =
    date && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!real) fail('That birthday is not a real date.');
  const age = ageFromBirthDate(birthDate);
  if (age < 18) fail('You need to be 18 or older.');
  if (age > 120) fail('That birthday is not a real date.');
}

export const saveProfile = mutation({
  args: {
    name: v.string(),
    birthDate: v.string(),
    gender,
    wantsToMeet: gender,
    city: v.string(),
    heightCm: v.number(),
    job: v.string(),
    bio: v.string(),
    photos: v.array(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `saveProfile:${userId}`, 30, 60 * 60_000);

    checkBirthDate(args.birthDate);
    if (!Number.isInteger(args.heightCm) || args.heightCm < 100 || args.heightCm > 250) {
      fail('Enter a height between 100 and 250 cm.');
    }
    if (args.photos.length !== 6 || new Set(args.photos).size !== 6) {
      fail('A profile needs exactly 6 photos.');
    }
    for (const photo of args.photos) await claimImage(ctx, userId, photo);

    const existing = await getProfile(ctx, userId);
    const fields = {
      userId,
      name: text(args.name, 'name', 50),
      birthDate: args.birthDate,
      gender: args.gender,
      wantsToMeet: args.wantsToMeet,
      city: text(args.city, 'city', 80),
      heightCm: args.heightCm,
      job: text(args.job, 'job or school', 80),
      bio: text(args.bio, 'bio', 500),
      photos: args.photos,
      // Recorded by the server the first time, so it can't be backdated.
      termsAcceptedAt: existing?.termsAcceptedAt ?? new Date().toISOString(),
    };

    if (existing) {
      for (const old of existing.photos) {
        if (!args.photos.includes(old)) await deleteImage(ctx, old);
      }
      await ctx.db.replace(existing._id, fields);
    } else {
      await ctx.db.insert('profiles', fields);
    }

    // Someone waiting in the queue is matched by what their profile says now.
    const queued = await ctx.db
      .query('queue')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (queued && !queued.roomId) {
      await ctx.db.patch(queued._id, { gender: args.gender, wantsToMeet: args.wantsToMeet });
    }

    return await profileView(ctx, (await getProfile(ctx, userId))!);
  },
});
