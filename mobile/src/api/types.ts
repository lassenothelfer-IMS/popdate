/**
 * Shapes the app gets from the server. They mirror the tables and server
 * functions in the root README. The app never decides roles, pops or which
 * photo is shown: it only reads these and calls `PopdateApi`.
 */

export type Gender = 'woman' | 'man';

export type Profile = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate: string;
  gender: Gender;
  wantsToMeet: Gender;
  city: string;
  heightCm: number;
  job: string;
  bio: string;
  /** Exactly 6 photo URIs, in order (position 1 to 6). */
  photos: string[];
  termsAcceptedAt: string;
};

export type ProfileDraft = Omit<Profile, 'id'>;

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
  /** True once the popper has gone over the pop time. There is no auto-pop. */
  popReminder: boolean;
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

export type Unsubscribe = () => void;

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
};

/** One method per server function in the root README. */
export interface PopdateApi {
  signIn(): Promise<string>;
  getMyProfile(): Promise<Profile | null>;
  saveProfile(draft: ProfileDraft): Promise<Profile>;

  joinQueue(): Promise<void>;
  leaveQueue(): Promise<void>;
  watchQueue(onChange: (status: QueueStatus) => void): Unsubscribe;

  watchRoom(roomId: string, onChange: (room: Room | null) => void): Unsubscribe;
  pickQuestion(roomId: string, questionId: string): Promise<void>;
  postAnswer(roomId: string, text: string): Promise<void>;
  popBalloon(roomId: string, contestantId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;

  listMatches(): Promise<Match[]>;
  getMatch(matchId: string): Promise<Match | null>;

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
  watchMessages(matchId: string, onChange: (messages: Message[]) => void): Unsubscribe;
  sendMessage(matchId: string, text: string): Promise<Message>;
}
