import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const gender = v.union(v.literal('woman'), v.literal('man'));

export const roomStatus = v.union(
  v.literal('picking'),
  v.literal('answering'),
  v.literal('popping'),
  v.literal('finished'),
);

export const reportReason = v.union(
  v.literal('harassment'),
  v.literal('fake'),
  v.literal('underage'),
  v.literal('inappropriate'),
  v.literal('spam'),
  v.literal('other'),
);

/**
 * Every table the app's server functions use. `users` and the other auth tables
 * come from Convex Auth; a player's id everywhere else is their `users` id.
 */
export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id('users'),
    name: v.string(),
    /** YYYY-MM-DD */
    birthDate: v.string(),
    gender,
    wantsToMeet: gender,
    city: v.string(),
    heightCm: v.number(),
    job: v.string(),
    bio: v.string(),
    /** Exactly 6 files, in order (position 1 to 6). */
    photos: v.array(v.id('_storage')),
    termsAcceptedAt: v.string(),
  }).index('by_user', ['userId']),

  /** Who uploaded each file, so nobody can put someone else's upload on their profile. */
  uploads: defineTable({
    storageId: v.id('_storage'),
    ownerId: v.id('users'),
  }).index('by_storage', ['storageId']),

  settings: defineTable({
    userId: v.id('users'),
    language: v.union(
      v.literal('system'),
      v.literal('en'),
      v.literal('de'),
      v.literal('fr'),
      v.literal('it'),
    ),
    region: v.union(v.string(), v.null()),
    units: v.union(v.literal('metric'), v.literal('imperial')),
    appearance: v.union(v.literal('system'), v.literal('light'), v.literal('dark')),
    commentFilter: v.boolean(),
    notifications: v.object({
      roomLive: v.boolean(),
      newMatch: v.boolean(),
      messages: v.boolean(),
    }),
  }).index('by_user', ['userId']),

  pushTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_token', ['token']),

  /** One selfie review per user. A person approves it in the dashboard for now. */
  verifications: defineTable({
    userId: v.id('users'),
    status: v.union(v.literal('pending'), v.literal('verified'), v.literal('rejected')),
    selfie: v.id('_storage'),
    submittedAt: v.number(),
  }).index('by_user', ['userId']),

  /**
   * Players waiting for a lobby. A row with a `roomId` has been matched into
   * that room and stays until the player queues again or leaves the queue.
   */
  queue: defineTable({
    userId: v.id('users'),
    gender,
    wantsToMeet: gender,
    joinedAt: v.number(),
    roomId: v.optional(v.id('rooms')),
  })
    .index('by_user', ['userId'])
    .index('by_room_joined', ['roomId', 'joinedAt']),

  questions: defineTable({
    text: v.string(),
    active: v.boolean(),
  }),

  rooms: defineTable({
    status: roomStatus,
    round: v.number(),
    totalRounds: v.number(),
    popperId: v.id('users'),
    questionId: v.optional(v.id('questions')),
    /** The questions the popper can pick from while `status` is `picking`. */
    questionOptionIds: v.array(v.id('questions')),
    usedQuestionIds: v.array(v.id('questions')),
    /** When the current answer or pop timer ends, in epoch milliseconds. */
    deadline: v.optional(v.number()),
    popReminder: v.boolean(),
    winnerId: v.optional(v.id('users')),
    matchId: v.optional(v.id('matches')),
    createdAt: v.number(),
  }).index('by_popper', ['popperId']),

  /** The contestants of a room. The popper is `rooms.popperId`. */
  roomPlayers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    seat: v.number(),
    popped: v.boolean(),
    poppedInRound: v.optional(v.number()),
    left: v.boolean(),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId']),

  answers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    round: v.number(),
    text: v.string(),
    createdAt: v.number(),
  }).index('by_room_round', ['roomId', 'round']),

  matches: defineTable({
    roomId: v.id('rooms'),
    popperId: v.id('users'),
    winnerId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_popper', ['popperId'])
    .index('by_winner', ['winnerId']),

  messages: defineTable({
    matchId: v.id('matches'),
    senderId: v.id('users'),
    text: v.string(),
    sentAt: v.number(),
  }).index('by_match', ['matchId']),

  blocks: defineTable({
    blockerId: v.id('users'),
    blockedId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_blocker', ['blockerId'])
    .index('by_blocked', ['blockedId'])
    .index('by_pair', ['blockerId', 'blockedId']),

  reports: defineTable({
    reporterId: v.id('users'),
    reportedId: v.id('users'),
    reason: reportReason,
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_reported', ['reportedId']),

  /** Fixed-window counters for the rate limits in `lib/rateLimit.ts`. */
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),
});
