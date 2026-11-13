import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const gender = v.union(v.literal('woman'), v.literal('man'));
/** Who someone wants to meet: one side of the room, or either. */
export const interest = v.union(v.literal('woman'), v.literal('man'), v.literal('everyone'));

export const waitlistPhone = v.union(v.literal('iphone'), v.literal('android'));
export const waitlistLanguage = v.union(v.literal('en'), v.literal('de'), v.literal('fr'), v.literal('it'));

export const roomStatus = v.union(
  v.literal('picking'),
  v.literal('answering'),
  v.literal('popping'),
  v.literal('finished'),
);

/** One message, as kept for a report. */
export const chatLine = v.object({ senderId: v.id('users'), text: v.string(), sentAt: v.number() });

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
    wantsToMeet: interest,
    /** How they describe their gender, like `nonbinary`; `gender` is their side of the room. */
    genderIdentity: v.optional(v.string()),
    genderDetails: v.optional(v.string()),
    sexuality: v.optional(v.string()),
    /** Up to three answers from their rooms, pinned to the profile. */
    pinnedAnswers: v.optional(v.array(v.object({ question: v.string(), answer: v.string() }))),
    city: v.string(),
    /** Optional, like job and bio (which are empty strings when left out). */
    heightCm: v.optional(v.number()),
    job: v.string(),
    bio: v.string(),
    /** Optional: up to five each, from the lists in `src/shared/profile-tags.ts`. */
    interests: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    /** 4 to 6 files, in order (position 1 to 6). */
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
    wantsToMeet: interest,
    joinedAt: v.number(),
    /** When the app last checked in from the queue screen; a row that stops checking in is dropped. */
    seenAt: v.optional(v.number()),
    roomId: v.optional(v.id('rooms')),
  })
    .index('by_user', ['userId'])
    .index('by_room_joined', ['roomId', 'joinedAt'])
    .index('by_room_seen', ['roomId', 'seenAt']),

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
    /** The live reveal of this round's answers: see `src/shared/reveal.ts`. */
    reveal: v.optional(
      v.object({
        startsAt: v.number(),
        turns: v.array(v.object({ id: v.string(), ms: v.number() })),
      }),
    ),
    /** The popper picked or popped at least once: they're really there. */
    popperActed: v.optional(v.boolean()),
    winnerId: v.optional(v.id('users')),
    matchId: v.optional(v.id('matches')),
    createdAt: v.number(),
    /** When the room finished, for your history. */
    endedAt: v.optional(v.number()),
  }).index('by_popper', ['popperId']),

  /** A chooser's second chance for the runner-up of their room. */
  secondChances: defineTable({
    roomId: v.id('rooms'),
    fromId: v.id('users'),
    toId: v.id('users'),
    status: v.union(v.literal('sent'), v.literal('accepted'), v.literal('declined')),
    createdAt: v.number(),
  })
    .index('by_from', ['fromId'])
    .index('by_to', ['toId'])
    .index('by_room', ['roomId']),

  /** The contestants of a room. The popper is `rooms.popperId`. */
  roomPlayers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    seat: v.number(),
    popped: v.boolean(),
    poppedInRound: v.optional(v.number()),
    left: v.boolean(),
    /** Set when they left while still holding a balloon; leaving after a pop doesn't set it. */
    leftInRound: v.optional(v.number()),
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId']),

  answers: defineTable({
    roomId: v.id('rooms'),
    userId: v.id('users'),
    round: v.number(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index('by_room_round', ['roomId', 'round'])
    .index('by_user', ['userId']),

  matches: defineTable({
    roomId: v.id('rooms'),
    popperId: v.id('users'),
    winnerId: v.id('users'),
    createdAt: v.number(),
    /** The chat's newest message: when, and from whom. For the "your turn" nudge. */
    lastMessageAt: v.optional(v.number()),
    lastSenderId: v.optional(v.id('users')),
    /** When the "your turn" push last went out, so a waiting message is nudged once. */
    nudgedAt: v.optional(v.number()),
  })
    .index('by_popper', ['popperId'])
    .index('by_winner', ['winnerId'])
    .index('by_last_message', ['lastMessageAt']),

  messages: defineTable({
    matchId: v.id('matches'),
    senderId: v.id('users'),
    text: v.string(),
    sentAt: v.number(),
    /** The message of this chat that this one answers. */
    replyTo: v.optional(v.id('messages')),
    /** One reaction per person. */
    reactions: v.optional(v.array(v.object({ userId: v.id('users'), emoji: v.string() }))),
    /** A voice message: the audio file, its length and its waveform. The text is then empty. */
    voice: v.optional(
      v.object({ storageId: v.id('_storage'), durationMs: v.number(), waveform: v.array(v.number()) }),
    ),
    /** The preview of the first link in the text, once its page has been read. */
    link: v.optional(
      v.object({
        url: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        image: v.optional(v.string()),
        site: v.string(),
      }),
    ),
  }).index('by_match', ['matchId']),

  /** Who is typing in which chat, and when they last were. */
  typing: defineTable({
    matchId: v.id('matches'),
    userId: v.id('users'),
    at: v.number(),
  }).index('by_match_user', ['matchId', 'userId']),

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
    /** The newest messages between the two, copied when the report is made. */
    transcript: v.optional(v.array(chatLine)),
    createdAt: v.number(),
  }).index('by_reported', ['reportedId']),

  /**
   * The last messages of a chat that ended (unmatch or a deleted account), kept
   * 30 days so it can still be reported, then deleted by `crons.ts`. Ids sorted: `aId < bId`.
   */
  endedChats: defineTable({
    aId: v.id('users'),
    bId: v.id('users'),
    messages: v.array(chatLine),
    endedAt: v.number(),
  })
    .index('by_pair', ['aId', 'bId'])
    .index('by_ended', ['endedAt']),

  /** How far the sweep of unclaimed uploads got, in `_creationTime` (one row). */
  uploadSweep: defineTable({
    after: v.number(),
  }),

  /**
   * Each player's balloons (rules in `src/shared/balloons.ts`). No row yet means a
   * new player's starting wallet; the first change writes it.
   */
  balloons: defineTable({
    userId: v.id('users'),
    /** Today's free balloons left. */
    free: v.number(),
    /** Bought and starter balloons left. */
    extra: v.number(),
    /** The UTC day the free ones were last topped up, YYYY-MM-DD. */
    refillDay: v.string(),
    /** Popdate+ until then, in epoch ms, from RevenueCat's webhook. */
    plusUntil: v.optional(v.number()),
    /** When the last Popdate+ event applied happened, so a late older one can't undo it. */
    plusEventAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  /** RevenueCat webhook events already applied, so a resend doesn't add a pack twice. */
  purchaseEvents: defineTable({
    eventId: v.string(),
    userId: v.optional(v.id('users')),
    type: v.string(),
    productId: v.optional(v.string()),
    /** SANDBOX or PRODUCTION: a test purchase must never be credited as a real one. */
    environment: v.optional(v.string()),
    /** APP_STORE, TEST_STORE, …: Test Store events only count where ACCEPT_TEST_STORE is set. */
    store: v.optional(v.string()),
    /** Recorded, but nothing was credited (a Test Store event on a deployment that refuses them). */
    ignored: v.optional(v.boolean()),
    /** Kept when no account was found, so the team can still credit the purchase by hand. */
    revenueCatIds: v.optional(v.array(v.string())),
    receivedAt: v.number(),
  }).index('by_event', ['eventId']),

  /** Fixed-window counters for the rate limits in `lib/rateLimit.ts`. */
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),

  /**
   * People who want an email when Popdate launches, from the waitlist page in `waitlist/`.
   * Nobody outside the Convex dashboard and `npx convex run` can read this table.
   */
  waitlist: defineTable({
    /** Trimmed and lowercased. */
    email: v.string(),
    phone: waitlistPhone,
    /** Country, city, gender and who they want to meet were asked until 2026-11-10. The page only asks for email and phone now, so older rows keep them. */
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    gender: v.optional(gender),
    wantsToMeet: v.optional(gender),
    language: v.optional(waitlistLanguage),
    /** Where they came from, from `?ref=` or `?utm_source=` on the page link, like "tiktok". */
    source: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('confirmed')),
    /** SHA-256 of the token in their confirm and leave links. The token itself is only ever in the email. */
    tokenHash: v.string(),
    /** Which consent text they agreed to, so it can be shown later. */
    consentVersion: v.string(),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
    lastEmailAt: v.optional(v.number()),
  })
    .index('by_email', ['email'])
    .index('by_token', ['tokenHash']),
});
