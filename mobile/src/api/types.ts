/**
 * Shapes the app gets from the server. They mirror the tables and server
 * functions in the root README. The app never decides roles, pops or which
 * photo is shown: it only reads these and calls `PopdateApi`.
 */

import type { BalloonsView } from '../shared/balloons';
import type { LinkPreview, VoiceNote } from '../shared/chat';
import type { Reveal } from '../shared/reveal';

/**
 * The two groups rooms are matched from. How you describe your own gender is
 * `Profile.genderIdentity`; this is only the side of the room you play on.
 */
export type Gender = 'woman' | 'man';

/** Who you want to meet: one side of the room, or either. */
export type Interest = Gender | 'everyone';

/**
 * The game's limits live in one module the server shares; re-exported here for the app.
 * A relative path, since Convex typechecks this file without the `@/` alias.
 */
export { MAX_PHOTOS, MAX_PINNED_ANSWERS, MIN_PHOTOS } from '../shared/limits';

export type Profile = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate: string;
  gender: Gender;
  wantsToMeet: Interest;
  /**
   * How you describe your gender, shown on your profile, like `nonbinary` or
   * `transWoman` (see `features/profile/identity.ts`). Missing: read `gender`.
   */
  genderIdentity?: string;
  /** Optional words of your own about your gender, like your pronouns. */
  genderDetails?: string;
  /** Optional: your sexuality, like `bisexual`. Not shown when missing. */
  sexuality?: string;
  /** Up to three answers from your rooms, pinned to your profile. */
  pinnedAnswers?: PinnedAnswer[];
  city: string;
  /** Optional: null when you haven't added it. */
  heightCm: number | null;
  /** Optional: empty when you haven't added it. */
  job: string;
  /** Optional: empty when you haven't added it. */
  bio: string;
  /** 4 to 6 photo URIs, in order (position 1 to 6). */
  photos: string[];
  termsAcceptedAt: string;
};

export type ProfileDraft = Omit<Profile, 'id'>;

/** An answer you gave in a room, pinned to your profile with its question. */
export type PinnedAnswer = { question: string; answer: string };

/**
 * One room you played, for your history and stats. `outcome` from your side:
 * `won` you were the last balloon, `popped` you were popped, `chose` you were
 * the chooser and it ended in a match, `left` you left before the end.
 */
export type RoomSummary = {
  roomId: string;
  endedAt: string;
  role: 'popper' | 'contestant';
  outcome: 'won' | 'popped' | 'chose' | 'left';
  /** The round you were popped in, when you were. */
  poppedInRound: number | null;
  totalRounds: number;
  popperName: string;
  /** Who the room ended with, when it ended in your match. */
  matchName: string | null;
  matchId: string | null;
  /** Each round's question, and your answer when you gave one. */
  rounds: { question: string; answer: string | null }[];
};

/** Who's queuing right now, for Home. */
export type QueueStats = {
  /** People in line now who could share a room with you. */
  waiting: number;
  /** Rooms that started in the last hour. */
  roomsLastHour: number;
};

/**
 * A second chance after a room. `almost`: the runner-up from a room you chose
 * in, and you can send them one. `sent`: you did, waiting on them. `incoming`:
 * the chooser of a room where you were the runner-up sent you one.
 */
export type SecondChance = {
  id: string;
  roomId: string;
  person: { id: string; name: string; age: number; photo: string };
  state: 'almost' | 'sent' | 'incoming';
  createdAt: string;
};

export type Question = {
  id: string;
  text: string;
};

/**
 * `picking`: the popper chooses this round's question.
 * `answering`: contestants type their answers.
 * `popping`: this round's photos are revealed and the popper pops one balloon.
 */
export type RoomStatus = 'picking' | 'answering' | 'popping' | 'finished';

export type RoomPlayer = {
  id: string;
  name: string;
  age: number;
  /** Only the photos the server has revealed so far. */
  photos: string[];
};

export type Contestant = RoomPlayer & {
  popped: boolean;
  poppedInRound: number | null;
  left: boolean;
  answered: boolean;
  /** This round's answer, or null while it is hidden from you or missing. */
  answer: string | null;
};

export type Room = {
  id: string;
  status: RoomStatus;
  round: number;
  totalRounds: number;
  popper: RoomPlayer;
  contestants: Contestant[];
  question: Question | null;
  /** The questions the popper can pick from while `status` is `picking`. */
  questionOptions: Question[];
  /** When the current answer or pop timer ends, in epoch milliseconds. */
  deadline: number | null;
  /**
   * True once the popper has gone over the pop time. `deadline` then counts down
   * to a random pop, so a room never stalls.
   */
  popReminder: boolean;
  /**
   * While popping: the live reveal, one contestant at a time, before the pop time
   * starts. Null in every other phase. See `src/shared/reveal.ts`.
   */
  reveal: Reveal | null;
  winnerId: string | null;
  matchId: string | null;
  me: { id: string; role: 'popper' | 'contestant' };
};

export type QueueStatus =
  | { state: 'idle' }
  | { state: 'searching'; found: number; needed: number }
  | { state: 'matched'; roomId: string };

export type Match = {
  id: string;
  roomId: string;
  other: { id: string; name: string; age: number; photo: string };
  createdAt: string;
};

/**
 * Everything on the profile of someone you matched with, and the room you
 * matched in, round by round. Only the two people of a match can read it.
 */
export type MatchProfile = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  genderIdentity?: string;
  sexuality?: string;
  city: string;
  /** Empty when they left it out. */
  job: string;
  bio: string;
  heightCm: number | null;
  /** All their photos, in their order. */
  photos: string[];
  verified: boolean;
  /** What they were in your room: the chooser, or one of the balloons. */
  role: 'popper' | 'contestant';
  /**
   * The room's rounds. The answers are the balloon's: theirs when they held
   * one, yours when they were the chooser. Null where there was none.
   */
  rounds: { round: number; question: string; answer: string | null }[];
  /** The round whose answer kept the last balloon, when the room ended with you two. */
  wonInRound: number | null;
};

export type Unsubscribe = () => void;

/**
 * Your balloons: free ones that top up every day, bought ones that keep, or
 * unlimited with Popdate+. The rules are in `src/shared/balloons.ts`.
 */
export type Balloons = BalloonsView;

/** `system` follows the phone. */
export type LanguageSetting = 'system' | 'en' | 'de' | 'fr' | 'it';
export type AppearanceSetting = 'system' | 'light' | 'dark';
export type Units = 'metric' | 'imperial';

/** Your settings, kept on the server so they follow your account to a new phone. */
export type Settings = {
  language: LanguageSetting;
  /** An ISO 3166 country code like 'CH', or null to follow the phone. */
  region: string | null;
  units: Units;
  appearance: AppearanceSetting;
  /** Hide offensive words in other people's answers and messages, on your phone only. */
  commentFilter: boolean;
  notifications: {
    /** A room you queued for is about to start. */
    roomLive: boolean;
    newMatch: boolean;
    messages: boolean;
  };
};

/**
 * Selfie verification. `pending` while a person (or service) reviews it;
 * only `verified` accounts will be allowed to queue once the backend enforces it.
 */
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type BlockedPerson = {
  id: string;
  name: string;
  age: number;
  photo: string;
  blockedAt: string;
};

export type ReportReason = 'harassment' | 'fake' | 'underage' | 'inappropriate' | 'spam' | 'other';

/** A chat message between you and a match. */
export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  /** Already filtered by the server's own profanity filter. */
  text: string;
  sentAt: string;
  /** The message this one answers, if any. */
  replyTo?: string | null;
  /** One reaction per person. */
  reactions?: { userId: string; emoji: string }[];
  /** The preview of the first link in the text, once its page has been read. */
  link?: LinkPreview | null;
  /** A voice message. The text is then empty. */
  voice?: VoiceNote | null;
};

/** One method per server function in the root README. */
export interface PopdateApi {
  signIn(): Promise<string>;
  getMyProfile(): Promise<Profile | null>;
  saveProfile(draft: ProfileDraft): Promise<Profile>;
  /**
   * Starts uploading a photo you just picked, so saving the profile later only
   * waits for whatever hasn't finished. Fire and forget; failures retry on save.
   */
  preparePhoto(uri: string): void;

  joinQueue(): Promise<void>;
  /**
   * Leave the line. When a room already formed with you in it, you stay seated
   * and get its id back, so the app can take you there; otherwise null.
   */
  leaveQueue(): Promise<string | null>;
  watchQueue(onChange: (status: QueueStatus) => void): Unsubscribe;
  /**
   * The queue screen calls this every `QUEUE_PING_MS` while you wait: a place in
   * line nobody checks in on (the app was closed) is dropped, so an absent player
   * is never put in a room.
   */
  pingQueue(): Promise<void>;
  /** Your balloons, live. Null while signed out. Joining the line needs one. */
  watchBalloons(onChange: (balloons: Balloons | null) => void): Unsubscribe;
  /**
   * A balloon pack was just bought in the store. The real server credits packs from
   * RevenueCat's webhook, never from the app, so there it does nothing; the mock credits it.
   */
  balloonsBought(productId: string): Promise<void>;

  watchRoom(roomId: string, onChange: (room: Room | null) => void): Unsubscribe;
  /** The room you're still playing in, if any, so reopening the app goes back to it. */
  getActiveRoom(): Promise<string | null>;
  pickQuestion(roomId: string, questionId: string): Promise<void>;
  postAnswer(roomId: string, text: string): Promise<void>;
  popBalloon(roomId: string, contestantId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;

  listMatches(): Promise<Match[]>;
  /** The rooms you played, newest first. */
  listRoomHistory(): Promise<RoomSummary[]>;
  getQueueStats(): Promise<QueueStats>;
  /** Runner-ups you can give a second chance, the ones you sent, and the ones sent to you. */
  listSecondChances(): Promise<SecondChance[]>;
  sendSecondChance(roomId: string, userId: string): Promise<void>;
  /** Accepting makes a match and resolves with it; declining resolves with null. */
  answerSecondChance(id: string, accept: boolean): Promise<Match | null>;
  getMatch(matchId: string): Promise<Match | null>;
  /** The full profile of the person you matched with, or null when the match is gone. */
  getMatchProfile(matchId: string): Promise<MatchProfile | null>;
  /** Ends a match for both of you; the chat goes with it. */
  unmatch(matchId: string): Promise<void>;

  /** Whether the server can be reached right now; called again on every change. */
  watchConnection(onChange: (online: boolean) => void): Unsubscribe;

  /** Ends the session on this phone. */
  signOut(): Promise<void>;
  /** Deletes the account, profile, photos, matches and messages. Apple requires this in the app. */
  deleteAccount(): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  /** The Expo push token for this phone, so the server can send room, match and message pushes. */
  registerPushToken(token: string): Promise<void>;

  getVerification(): Promise<VerificationStatus>;
  /** Uploads a selfie for review. Resolves with the new status. */
  submitSelfie(photoUri: string): Promise<VerificationStatus>;

  listBlocked(): Promise<BlockedPerson[]>;
  /** Blocked people are never put in your rooms again and can't message you. */
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  report(userId: string, reason: ReportReason, details?: string): Promise<void>;

  listMessages(matchId: string): Promise<Message[]>;
  /** `onError` runs when the chat can't be read, so it isn't mistaken for an empty one. */
  watchMessages(matchId: string, onChange: (messages: Message[]) => void, onError?: () => void): Unsubscribe;
  /** `replyTo` is the message this one answers. */
  sendMessage(matchId: string, text: string, replyTo?: string): Promise<Message>;
  /** Sends a recording on the phone as a voice message. */
  sendVoice(
    matchId: string,
    recording: { uri: string; durationMs: number; waveform: number[] },
    replyTo?: string,
  ): Promise<Message>;
  /** One of the chat's reactions on a message, or `null` to take yours back. */
  reactToMessage(matchId: string, messageId: string, emoji: string | null): Promise<void>;
  /** Says you are typing right now. The composer repeats it while you type. */
  setTyping(matchId: string): Promise<void>;
  /** When the other person last typed, as a timestamp, or null. */
  watchTyping(matchId: string, onChange: (typedAt: number | null) => void): Unsubscribe;
}
