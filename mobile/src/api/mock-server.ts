/**
 * In-memory stand-in for the Supabase backend, so the app can be built and
 * played before Jonas's server functions exist. It follows the same rules
 * the real server will: the queue builds a lobby of 1 popper + 5 contestants,
 * timers and photo reveals run here, and the app only sees the `Room` view.
 * Every other player in a room is a bot.
 */
import type {
  BlockedPerson,
  Contestant,
  Gender,
  Match,
  Message,
  PopdateApi,
  ReportReason,
  Settings,
  VerificationStatus,
  Profile,
  ProfileDraft,
  Question,
  QueueStatus,
  Room,
  RoomPlayer,
  RoomStatus,
} from '@/api/types';
import { ageFromBirthDate } from '@/utils/birth-date';
import { maskProfanity } from '@/utils/profanity';

const LOBBY_SIZE = 6;
const ANSWER_MS = 60_000;
const POP_REMINDER_MS = 30_000;
const QUESTION_OPTIONS_PER_ROUND = 5;

const QUESTIONS: Question[] = [
  'What would your friends say is your worst habit?',
  "What's the most spontaneous thing you've ever done?",
  'What does your perfect Sunday look like?',
  "What's a red flag you secretly have?",
  "What's the last thing that made you laugh really hard?",
  'Which song plays when you walk into a room?',
  "What's your most controversial food opinion?",
  'What would you do with a free week and no money?',
  "What's something you're weirdly good at?",
  "What's your go-to karaoke song?",
  "What's the best date you've ever been on?",
  'Cats or dogs? Defend your answer.',
  "What's a dealbreaker for you?",
  'What would your ex say about you?',
  "What's your biggest ick?",
  'What are you irrationally scared of?',
].map((text, index) => ({ id: `q${index + 1}`, text }));

const BOT_ANSWERS = [
  'Honestly? My snooze button addiction.',
  "Pineapple on pizza, and I'll die on that hill.",
  'Planning trips I never actually take.',
  'Always late, but worth the wait.',
  'A long walk, a good coffee and zero plans.',
  'I once booked a flight the same morning. No regrets.',
  'Singing in the car way too loud.',
  'Talking to dogs more than to people.',
  'Making pasta from scratch at 2am.',
  "I'm weirdly good at parallel parking.",
  'Overthinking every text before I send it.',
  'Bad music taste, apparently. I disagree.',
  'Starting a new hobby every month.',
  'Sending memes instead of replying properly.',
  'A road trip with no destination.',
  'Pigeons. Do not ask.',
];

const BOT_NAMES: Record<Gender, string[]> = {
  woman: ['Lena', 'Mia', 'Sara', 'Nina', 'Lea', 'Emma', 'Julia', 'Alina', 'Laura', 'Sofia'],
  man: ['Luca', 'Noah', 'Leon', 'Jan', 'Nico', 'Elias', 'David', 'Tim', 'Ben', 'Fabio'],
};

export type MockRole = 'random' | 'popper' | 'contestant';

const MAX_MESSAGE_LENGTH = 1000;

const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  region: null,
  units: 'metric',
  appearance: 'system',
  commentFilter: true,
  notifications: { roomLive: true, newMatch: true, messages: true },
};

const BOT_REPLIES = [
  'Haha, okay that answer of yours won me over.',
  'So, coffee or a walk by the lake?',
  'I was hoping it would be you in the end.',
  'Tell me the pizza argument. I need to know.',
  'That was the most stressful game of my life.',
  'Hi! What made you pick me?',
  'Okay, your turn: worst habit, go.',
];

type Player = RoomPlayer & { isBot: boolean };

type Seat = {
  player: Player;
  popped: boolean;
  poppedInRound: number | null;
  left: boolean;
  answers: Map<number, string>;
};

type ServerRoom = {
  id: string;
  status: RoomStatus;
  round: number;
  popper: Player;
  seats: Seat[];
  question: Question | null;
  questionOptions: Question[];
  usedQuestionIds: Set<string>;
  deadline: number | null;
  popReminder: boolean;
  winnerId: string | null;
  matchId: string | null;
  timers: ReturnType<typeof setTimeout>[];
  listeners: Set<(room: Room | null) => void>;
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isActive(seat: Seat) {
  return !seat.popped;
}

class MockServer implements PopdateApi {
  private userId: string | null = null;
  private profile: Profile | null = null;
  private queue: QueueStatus = { state: 'idle' };
  private queueListeners = new Set<(status: QueueStatus) => void>();
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private rooms = new Map<string, ServerRoom>();
  private matches: Match[] = [];
  private usedBotNames = new Set<string>();
  private settings: Settings = { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
  private verification: VerificationStatus = 'none';
  private blocked: BlockedPerson[] = [];
  private messages = new Map<string, Message[]>();
  private messageListeners = new Map<string, Set<(messages: Message[]) => void>>();

  nextRole: MockRole = 'random';

  async signIn() {
    this.userId ??= `user-${randomId()}`;
    return this.userId;
  }

  async getMyProfile() {
    return this.profile;
  }

  async saveProfile(draft: ProfileDraft) {
    const userId = await this.signIn();
    if (draft.photos.length !== 6) throw new Error('A profile needs exactly 6 photos.');
    if (ageFromBirthDate(draft.birthDate) < 18) throw new Error('You need to be 18 or older.');
    this.profile = { ...draft, id: userId };
    return this.profile;
  }

  // Queue

  async joinQueue() {
    if (!this.profile) throw new Error('Finish your profile before you play.');
    this.clearQueueTimer();
    this.setQueue({ state: 'searching', found: 1, needed: LOBBY_SIZE });
    this.queueTimer = setInterval(() => {
      if (this.queue.state !== 'searching') return;
      const found = this.queue.found + 1;
      if (found < LOBBY_SIZE) {
        this.setQueue({ state: 'searching', found, needed: LOBBY_SIZE });
        return;
      }
      this.clearQueueTimer();
      const room = this.createRoom();
      this.setQueue({ state: 'matched', roomId: room.id });
    }, 700);
  }

  async leaveQueue() {
    this.clearQueueTimer();
    this.setQueue({ state: 'idle' });
  }

  watchQueue(onChange: (status: QueueStatus) => void) {
    this.queueListeners.add(onChange);
    onChange(this.queue);
    return () => {
      this.queueListeners.delete(onChange);
    };
  }

  private setQueue(status: QueueStatus) {
    this.queue = status;
    this.queueListeners.forEach((listener) => listener(status));
  }

  private clearQueueTimer() {
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.queueTimer = null;
  }

  // Rooms

  watchRoom(roomId: string, onChange: (room: Room | null) => void) {
    const room = this.rooms.get(roomId);
    if (!room) {
      onChange(null);
      return () => {};
    }
    room.listeners.add(onChange);
    onChange(this.toView(room));
    return () => {
      room.listeners.delete(onChange);
    };
  }

  async pickQuestion(roomId: string, questionId: string) {
    const room = this.requireRoom(roomId);
    if (room.popper.id !== this.userId) throw new Error('Only the popper picks the question.');
    if (room.status !== 'picking') throw new Error('The question is already picked.');
    const question = room.questionOptions.find((option) => option.id === questionId);
    if (!question) throw new Error('That question is not one of the options.');
    this.startAnswering(room, question);
  }

  async postAnswer(roomId: string, text: string) {
    const room = this.requireRoom(roomId);
    const seat = room.seats.find((s) => s.player.id === this.userId);
    const answer = text.trim();
    if (!seat || !isActive(seat)) throw new Error("You can't answer in this round.");
    if (room.status !== 'answering') throw new Error('Answer time is over.');
    if (seat.answers.has(room.round)) throw new Error('You already answered.');
    if (!answer || answer.length > 280) throw new Error('Answers are 1 to 280 characters.');
    seat.answers.set(room.round, answer);
    this.emit(room);
    this.endAnsweringIfEveryoneAnswered(room);
  }

  async popBalloon(roomId: string, contestantId: string) {
    const room = this.requireRoom(roomId);
    if (room.popper.id !== this.userId) throw new Error('Only the popper can pop.');
    if (room.status !== 'popping') throw new Error("It's not time to pop yet.");
    const seat = room.seats.find((s) => s.player.id === contestantId);
    if (!seat || !isActive(seat)) throw new Error('That balloon is already popped.');
    this.pop(room, seat);
  }

  async leaveRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.status === 'finished') return;

    if (room.popper.id === this.userId) {
      // Without a popper the room can't go on.
      this.clearTimers(room);
      room.status = 'finished';
      room.deadline = null;
      this.emit(room);
      return;
    }

    const seat = room.seats.find((s) => s.player.id === this.userId);
    if (!seat) return;
    seat.left = true;
    if (isActive(seat)) {
      // Leaving mid-game counts as popped, and the round goes on.
      seat.popped = true;
      seat.poppedInRound = room.round;
      if (room.seats.filter(isActive).length <= 1) {
        this.finish(room);
        return;
      }
      this.emit(room);
      this.endAnsweringIfEveryoneAnswered(room);
      return;
    }
    this.emit(room);
  }

  // Matches

  async listMatches() {
    return [...this.matches].reverse();
  }

  async getMatch(matchId: string) {
    return this.matches.find((match) => match.id === matchId) ?? null;
  }

  // Account

  async signOut() {
    // A test account is anonymous: signing out ends it. Sign in with Apple will let people come back.
    this.reset();
  }

  async deleteAccount() {
    this.reset();
  }

  private reset() {
    this.clearQueueTimer();
    this.setQueue({ state: 'idle' });
    this.rooms.forEach((room) => this.clearTimers(room));
    this.rooms.clear();
    this.userId = null;
    this.profile = null;
    this.matches = [];
    this.messages.clear();
    this.blocked = [];
    this.verification = 'none';
    this.settings = { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } };
  }

  // Settings

  async getSettings() {
    return structuredClone(this.settings);
  }

  async saveSettings(settings: Settings) {
    this.settings = structuredClone(settings);
    return structuredClone(this.settings);
  }

  async registerPushToken(token: string) {
    this.pushToken = token;
  }

  pushToken: string | null = null;

  // Verification

  async getVerification() {
    return this.verification;
  }

  async submitSelfie(photoUri: string) {
    if (!photoUri) throw new Error('Take a selfie first.');
    this.verification = 'pending';
    // A person reviews it on the real server; the mock approves after a few seconds.
    setTimeout(() => {
      if (this.verification === 'pending') this.verification = 'verified';
    }, 4000);
    return this.verification;
  }

  // Safety

  async listBlocked() {
    return [...this.blocked];
  }

  async block(userId: string) {
    if (this.blocked.some((person) => person.id === userId)) return;
    const known = this.findPerson(userId);
    this.blocked.push({
      id: userId,
      name: known?.name ?? 'Someone',
      age: known?.age ?? 0,
      photo: known?.photo ?? 'mock://blocked',
      blockedAt: new Date().toISOString(),
    });
  }

  async unblock(userId: string) {
    this.blocked = this.blocked.filter((person) => person.id !== userId);
  }

  async report(userId: string, reason: ReportReason, details?: string) {
    if (!userId || !reason) throw new Error('Choose a reason.');
    void details;
  }

  private findPerson(userId: string) {
    const match = this.matches.find((m) => m.other.id === userId);
    if (match) return match.other;
    for (const room of this.rooms.values()) {
      const player =
        room.popper.id === userId ? room.popper : room.seats.find((seat) => seat.player.id === userId)?.player;
      if (player) return { name: player.name, age: player.age, photo: player.photos[0] };
    }
    return null;
  }

  // Chat

  async listMessages(matchId: string) {
    this.requireMatch(matchId);
    return [...(this.messages.get(matchId) ?? [])];
  }

  watchMessages(matchId: string, onChange: (messages: Message[]) => void) {
    const listeners = this.messageListeners.get(matchId) ?? new Set();
    listeners.add(onChange);
    this.messageListeners.set(matchId, listeners);
    onChange([...(this.messages.get(matchId) ?? [])]);
    return () => {
      listeners.delete(onChange);
    };
  }

  async sendMessage(matchId: string, text: string) {
    const match = this.requireMatch(matchId);
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Write something first.');
    if (trimmed.length > MAX_MESSAGE_LENGTH) throw new Error('That message is too long.');
    if (this.blocked.some((person) => person.id === match.other.id)) {
      throw new Error("You blocked this person, so you can't message them.");
    }
    const message = this.addMessage(matchId, this.userId ?? 'me', trimmed);
    // The other person is a bot: it answers now and then, after a little while.
    if (Math.random() < 0.8) {
      setTimeout(() => {
        if (this.matches.some((m) => m.id === matchId)) {
          this.addMessage(matchId, match.other.id, pickRandom(BOT_REPLIES));
        }
      }, randomInt(1500, 4000));
    }
    return message;
  }

  private addMessage(matchId: string, senderId: string, text: string) {
    const message: Message = {
      id: `msg-${randomId()}`,
      matchId,
      senderId,
      // The server's own filter: the worst words never reach anyone.
      text: maskProfanity(text),
      sentAt: new Date().toISOString(),
    };
    const list = [...(this.messages.get(matchId) ?? []), message];
    this.messages.set(matchId, list);
    this.messageListeners.get(matchId)?.forEach((listener) => listener([...list]));
    return message;
  }

  private requireMatch(matchId: string) {
    const match = this.matches.find((m) => m.id === matchId);
    if (!match) throw new Error("This match doesn't exist.");
    return match;
  }

  // Game flow

  private createRoom() {
    const me = this.profile!;
    const self: Player = {
      id: me.id,
      name: me.name,
      age: ageFromBirthDate(me.birthDate),
      photos: me.photos,
      isBot: false,
    };
    const role =
      this.nextRole === 'random' ? (Math.random() < 0.5 ? 'popper' : 'contestant') : this.nextRole;

    let popper: Player;
    let contestants: Player[];
    if (role === 'popper') {
      popper = self;
      contestants = Array.from({ length: LOBBY_SIZE - 1 }, () => this.makeBot(me.wantsToMeet));
    } else {
      popper = this.makeBot(me.wantsToMeet);
      const others = Array.from({ length: LOBBY_SIZE - 2 }, () => this.makeBot(me.gender));
      contestants = shuffle([self, ...others]);
    }

    const room: ServerRoom = {
      id: `room-${randomId()}`,
      status: 'picking',
      round: 1,
      popper,
      seats: contestants.map((player) => ({
        player,
        popped: false,
        poppedInRound: null,
        left: false,
        answers: new Map(),
      })),
      question: null,
      questionOptions: [],
      usedQuestionIds: new Set(),
      deadline: null,
      popReminder: false,
      winnerId: null,
      matchId: null,
      timers: [],
      listeners: new Set(),
    };
    this.rooms.set(room.id, room);
    this.startRound(room);
    return room;
  }

  private makeBot(gender: Gender): Player {
    const names = BOT_NAMES[gender].filter((name) => !this.usedBotNames.has(name));
    if (names.length === 0) this.usedBotNames.clear();
    const name = pickRandom(names.length > 0 ? names : BOT_NAMES[gender]);
    this.usedBotNames.add(name);
    const id = `bot-${randomId()}`;
    return {
      id,
      name,
      age: randomInt(19, 32),
      photos: Array.from({ length: 6 }, (_, i) => `mock://${id}/${i + 1}`),
      isBot: true,
    };
  }

  private startRound(room: ServerRoom) {
    this.clearTimers(room);
    room.status = 'picking';
    room.question = null;
    room.deadline = null;
    room.popReminder = false;
    const unused = QUESTIONS.filter((q) => !room.usedQuestionIds.has(q.id));
    room.questionOptions = shuffle(unused).slice(0, QUESTION_OPTIONS_PER_ROUND);
    this.emit(room);

    if (room.popper.isBot) {
      this.after(room, randomInt(2000, 3500), () => {
        this.startAnswering(room, pickRandom(room.questionOptions));
      });
    }
  }

  private startAnswering(room: ServerRoom, question: Question) {
    this.clearTimers(room);
    room.status = 'answering';
    room.question = question;
    room.questionOptions = [];
    room.usedQuestionIds.add(question.id);
    room.deadline = Date.now() + ANSWER_MS;
    this.emit(room);

    this.after(room, ANSWER_MS, () => this.startPopping(room));
    for (const seat of room.seats) {
      if (!seat.player.isBot || !isActive(seat)) continue;
      this.after(room, randomInt(3000, 15000), () => {
        if (room.status !== 'answering' || !isActive(seat)) return;
        seat.answers.set(room.round, pickRandom(BOT_ANSWERS));
        this.emit(room);
        this.endAnsweringIfEveryoneAnswered(room);
      });
    }
  }

  private endAnsweringIfEveryoneAnswered(room: ServerRoom) {
    if (room.status !== 'answering') return;
    const waiting = room.seats.filter((s) => isActive(s) && !s.answers.has(room.round));
    if (waiting.length === 0) this.startPopping(room);
  }

  private startPopping(room: ServerRoom) {
    this.clearTimers(room);
    room.status = 'popping';
    room.deadline = Date.now() + POP_REMINDER_MS;
    room.popReminder = false;
    this.emit(room);

    this.after(room, POP_REMINDER_MS, () => {
      room.popReminder = true;
      this.emit(room);
    });
    if (room.popper.isBot) {
      this.after(room, randomInt(3500, 6000), () => {
        this.pop(room, pickRandom(room.seats.filter(isActive)));
      });
    }
  }

  private pop(room: ServerRoom, seat: Seat) {
    this.clearTimers(room);
    seat.popped = true;
    seat.poppedInRound = room.round;
    if (room.seats.filter(isActive).length <= 1) {
      this.finish(room);
      return;
    }
    room.round += 1;
    this.startRound(room);
  }

  private finish(room: ServerRoom) {
    this.clearTimers(room);
    room.status = 'finished';
    room.deadline = null;
    room.popReminder = false;
    const winner = room.seats.find(isActive)?.player ?? null;
    room.winnerId = winner?.id ?? null;

    const iAmPopper = room.popper.id === this.userId;
    if (winner && (iAmPopper || winner.id === this.userId)) {
      const other = iAmPopper ? winner : room.popper;
      const match: Match = {
        id: `match-${randomId()}`,
        roomId: room.id,
        other: { id: other.id, name: other.name, age: other.age, photo: other.photos[0] },
        createdAt: new Date().toISOString(),
      };
      this.matches.push(match);
      room.matchId = match.id;
    }
    this.emit(room);
  }

  // Helpers

  private requireRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('This room does not exist anymore.');
    return room;
  }

  private after(room: ServerRoom, ms: number, run: () => void) {
    room.timers.push(setTimeout(run, ms));
  }

  private clearTimers(room: ServerRoom) {
    room.timers.forEach(clearTimeout);
    room.timers = [];
  }

  private emit(room: ServerRoom) {
    const view = this.toView(room);
    room.listeners.forEach((listener) => listener(view));
  }

  /** What the signed-in player is allowed to see of a room. */
  private toView(room: ServerRoom): Room {
    const myRole = room.popper.id === this.userId ? 'popper' : 'contestant';
    // Photo N unlocks once round N's answers are in.
    const revealed =
      room.status === 'picking' || room.status === 'answering' ? room.round - 1 : room.round;

    const contestants: Contestant[] = room.seats.map((seat) => {
      const photoCount = seat.popped ? Math.min(revealed, seat.poppedInRound ?? 0) : revealed;
      // While answering, only the popper sees answers as they come in.
      const answerVisible =
        myRole === 'popper' || room.status !== 'answering' || seat.player.id === this.userId;
      return {
        id: seat.player.id,
        name: seat.player.name,
        age: seat.player.age,
        photos: seat.player.photos.slice(0, photoCount),
        popped: seat.popped,
        poppedInRound: seat.poppedInRound,
        left: seat.left,
        answered: seat.answers.has(room.round),
        answer: answerVisible ? (seat.answers.get(room.round) ?? null) : null,
      };
    });

    return {
      id: room.id,
      status: room.status,
      round: room.round,
      totalRounds: room.seats.length - 1,
      popper: {
        id: room.popper.id,
        name: room.popper.name,
        age: room.popper.age,
        photos: room.popper.photos.slice(0, 1),
      },
      contestants,
      question: room.question,
      questionOptions: room.questionOptions,
      deadline: room.deadline,
      popReminder: room.popReminder,
      winnerId: room.winnerId,
      matchId: room.matchId,
      me: { id: this.userId ?? '', role: myRole },
    };
  }
}

export const mockServer = new MockServer();
