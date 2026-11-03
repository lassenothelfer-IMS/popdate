import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ANSWER_GRACE_MS, ANSWER_MS, PICK_MS } from './lib/game';
import schema from './schema';
import { modules } from './test.setup';

type Gender = 'woman' | 'man';
type Interest = Gender | 'everyone';
type Tester = ReturnType<typeof convexTest>;

beforeEach(() => {
  vi.useFakeTimers();
  // Small rooms keep the tests short: a popper and two contestants, one round.
  process.env.LOBBY_SIZE = '3';
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LOBBY_SIZE;
});

async function storePhotos(t: Tester, label: string) {
  return await t.run(async (ctx) => {
    const photos: Id<'_storage'>[] = [];
    for (let i = 1; i <= 6; i++) {
      photos.push(await ctx.storage.store(new Blob([`${label}-${i}`], { type: 'image/jpeg' })));
    }
    return photos;
  });
}

/** A signed-in player with a finished profile. */
async function player(t: Tester, name: string, gender: Gender, wantsToMeet: Interest) {
  const userId = await t.run(async (ctx) => await ctx.db.insert('users', {}));
  const as = t.withIdentity({ subject: `${userId}|test-session` });
  await as.mutation(api.profiles.saveProfile, {
    name,
    birthDate: '1998-04-02',
    gender,
    wantsToMeet,
    city: 'Zurich',
    heightCm: 175,
    job: 'Student',
    bio: 'Hi there',
    photos: await storePhotos(t, name),
  });
  return { id: userId as string, userId, as };
}

/** Lena pops, Luca and Noah hold balloons. */
async function startRoom() {
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'man');
  const luca = await player(t, 'Luca', 'man', 'woman');
  const noah = await player(t, 'Noah', 'man', 'woman');
  for (const p of [lena, luca, noah]) await p.as.mutation(api.queue.joinQueue, {});
  const status = await lena.as.query(api.queue.status, {});
  if (status.state !== 'matched') throw new Error('No room formed');
  return { t, lena, luca, noah, roomId: status.roomId };
}

async function view(p: { as: ReturnType<Tester['withIdentity']> }, roomId: string) {
  const room = await p.as.query(api.rooms.get, { roomId });
  if (!room) throw new Error('Room not visible');
  return room;
}

async function pickFirstQuestion(lena: { as: ReturnType<Tester['withIdentity']> }, roomId: string) {
  const room = await view(lena, roomId);
  await lena.as.mutation(api.rooms.pickQuestion, { roomId, questionId: room.questionOptions[0].id });
}

test('a lobby forms only from people who want to meet each other', async () => {
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'man');
  const max = await player(t, 'Max', 'man', 'man');
  const luca = await player(t, 'Luca', 'man', 'woman');
  const noah = await player(t, 'Noah', 'man', 'woman');

  await lena.as.mutation(api.queue.joinQueue, {});
  await max.as.mutation(api.queue.joinQueue, {});
  await luca.as.mutation(api.queue.joinQueue, {});
  expect(await lena.as.query(api.queue.status, {})).toMatchObject({ state: 'searching', needed: 3 });

  await noah.as.mutation(api.queue.joinQueue, {});
  const status = await lena.as.query(api.queue.status, {});
  expect(status.state).toBe('matched');
  // Max wants to meet men, so he isn't in a room with Lena.
  expect(await max.as.query(api.queue.status, {})).toMatchObject({ state: 'searching' });

  const room = await view(lena, status.state === 'matched' ? status.roomId : '');
  expect(room.me.role).toBe('popper');
  expect(room.contestants.map((c) => c.id).sort()).toEqual([luca.id, noah.id].sort());
  expect(room.totalRounds).toBe(1);
});

test('people who blocked each other are never put in the same room', async () => {
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'man');
  const luca = await player(t, 'Luca', 'man', 'woman');
  const noah = await player(t, 'Noah', 'man', 'woman');
  const ben = await player(t, 'Ben', 'man', 'woman');
  await luca.as.mutation(api.safety.block, { userId: noah.id });

  for (const p of [lena, luca, noah]) await p.as.mutation(api.queue.joinQueue, {});
  expect((await lena.as.query(api.queue.status, {})).state).toBe('searching');

  await ben.as.mutation(api.queue.joinQueue, {});
  const status = await lena.as.query(api.queue.status, {});
  const room = await view(lena, status.state === 'matched' ? status.roomId : '');
  expect(room.contestants.map((c) => c.id).sort()).toEqual([luca.id, ben.id].sort());
  expect((await noah.as.query(api.queue.status, {})).state).toBe('searching');
});

test('photos unlock round by round and answers stay hidden from other contestants', async () => {
  const { lena, luca, noah, roomId } = await startRoom();

  let room = await view(luca, roomId);
  expect(room.popper.photos).toHaveLength(1);
  expect(room.contestants.every((c) => c.photos.length === 0)).toBe(true);
  expect(room.questionOptions).toEqual([]);
  expect((await view(lena, roomId)).questionOptions.length).toBeGreaterThan(0);

  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'Pineapple on pizza' });

  const lucaSeen = (await view(noah, roomId)).contestants.find((c) => c.id === luca.id)!;
  expect(lucaSeen.answered).toBe(true);
  expect(lucaSeen.answer).toBeNull();
  const lucaToPopper = (await view(lena, roomId)).contestants.find((c) => c.id === luca.id)!;
  expect(lucaToPopper.answer).toBe('Pineapple on pizza');

  await noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'Long walks' });
  room = await view(luca, roomId);
  expect(room.status).toBe('popping');
  expect(room.contestants.every((c) => c.photos.length === 1)).toBe(true);
  expect(room.contestants.find((c) => c.id === noah.id)!.answer).toBe('Long walks');
});

test('the last balloon matches with the popper, and a second pop changes nothing', async () => {
  const { lena, luca, noah, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'A' });
  await noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'B' });

  await lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: noah.id });
  await expect(
    lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: luca.id }),
  ).rejects.toThrow("It's not time to pop yet.");

  const room = await view(lena, roomId);
  expect(room.status).toBe('finished');
  expect(room.winnerId).toBe(luca.id);
  expect(room.matchId).not.toBeNull();
  expect((await view(luca, roomId)).matchId).toBe(room.matchId);
  // Noah was popped: he sees the ending, not the match.
  expect((await view(noah, roomId)).matchId).toBeNull();

  const [match] = await luca.as.query(api.matches.list, {});
  expect(match.other).toMatchObject({ id: lena.id, name: 'Lena' });
  expect(await noah.as.query(api.matches.get, { matchId: room.matchId! })).toBeNull();
});

test('only the two people in a match can chat, and bad words are masked', async () => {
  const { lena, luca, noah, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'A' });
  await noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'B' });
  await lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: noah.id });
  const matchId = (await view(lena, roomId)).matchId!;

  const sent = await lena.as.mutation(api.chat.send, { matchId, text: 'You are a fucking legend' });
  expect(sent.text).toBe('You are a ••••••• legend');
  expect(await luca.as.query(api.chat.list, { matchId })).toHaveLength(1);
  await expect(noah.as.query(api.chat.list, { matchId })).rejects.toThrow("This match doesn't exist.");

  await luca.as.mutation(api.safety.block, { userId: lena.id });
  await expect(lena.as.mutation(api.chat.send, { matchId, text: 'Hi?' })).rejects.toThrow(
    "You can't message this person anymore.",
  );
});

test('only the popper picks and pops, and outsiders see nothing', async () => {
  const { t, lena, luca, roomId } = await startRoom();
  const outsider = await player(t, 'Mia', 'woman', 'man');

  await expect(view(outsider, roomId)).rejects.toThrow('Room not visible');
  const options = (await view(lena, roomId)).questionOptions;
  await expect(
    luca.as.mutation(api.rooms.pickQuestion, { roomId, questionId: options[0].id }),
  ).rejects.toThrow('Only the popper picks the question.');
  await expect(
    luca.as.mutation(api.rooms.popBalloon, { roomId, contestantId: luca.id }),
  ).rejects.toThrow('Only the popper can pop.');
});

test('timers move answering on to popping and remind the popper, but never pop', async () => {
  const { t, lena, luca, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'Only me' });

  vi.advanceTimersByTime(ANSWER_MS + ANSWER_GRACE_MS + 1);
  await t.finishInProgressScheduledFunctions();
  let room = await view(lena, roomId);
  expect(room.status).toBe('popping');
  expect(room.popReminder).toBe(false);

  vi.advanceTimersByTime(30_001);
  await t.finishInProgressScheduledFunctions();
  room = await view(lena, roomId);
  expect(room.status).toBe('popping');
  expect(room.popReminder).toBe(true);
  expect(room.contestants.every((c) => !c.popped)).toBe(true);
});

test('the popper leaving ends the room without a match; a contestant leaving counts as popped', async () => {
  const first = await startRoom();
  await first.lena.as.mutation(api.rooms.leaveRoom, { roomId: first.roomId });
  const ended = await view(first.luca, first.roomId);
  expect(ended.status).toBe('finished');
  expect(ended.winnerId).toBeNull();

  const second = await startRoom();
  await second.noah.as.mutation(api.rooms.leaveRoom, { roomId: second.roomId });
  const won = await view(second.lena, second.roomId);
  expect(won.status).toBe('finished');
  expect(won.winnerId).toBe(second.luca.id);
  expect(won.contestants.find((c) => c.id === second.noah.id)).toMatchObject({ popped: true, left: true });
});

test('profiles need 6 of your own photos and an 18+ birthday', async () => {
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'man');
  const userId = await t.run(async (ctx) => await ctx.db.insert('users', {}));
  const mia = t.withIdentity({ subject: `${userId}|test-session` });
  const base = {
    name: 'Mia',
    birthDate: '1999-01-01',
    gender: 'woman' as const,
    wantsToMeet: 'man' as const,
    city: 'Bern',
    heightCm: 168,
    job: 'Nurse',
    bio: 'Hello',
  };

  const own = await storePhotos(t, 'Mia');
  await expect(
    mia.mutation(api.profiles.saveProfile, { ...base, photos: own.slice(0, 3) }),
  ).rejects.toThrow('A profile needs 4 to 6 photos.');
  await expect(
    mia.mutation(api.profiles.saveProfile, { ...base, birthDate: '2015-05-05', photos: own }),
  ).rejects.toThrow('You need to be 18 or older.');

  const lenasPhotos = await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', lena.userId))
      .unique();
    return profile!.photos;
  });
  await expect(
    mia.mutation(api.profiles.saveProfile, { ...base, photos: lenasPhotos }),
  ).rejects.toThrow('A photo did not upload. Try again.');

  const saved = await mia.mutation(api.profiles.saveProfile, { ...base, photos: own });
  expect(saved.photos).toHaveLength(6);
});

test('deleting an account removes the profile, matches, chat and sign-in records', async () => {
  const { t, lena, luca, noah, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'A' });
  await noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'B' });
  await lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: noah.id });
  const matchId = (await view(lena, roomId)).matchId!;
  await luca.as.mutation(api.chat.send, { matchId, text: 'Hi Lena' });
  await t.run(async (ctx) => {
    await ctx.db.insert('authSessions', { userId: luca.userId, expirationTime: Date.now() + 60_000 });
  });

  await luca.as.mutation(api.account.deleteAccount, {});

  expect(await lena.as.query(api.matches.list, {})).toEqual([]);
  const left = await t.run(async (ctx) => ({
    user: await ctx.db.get(luca.userId),
    profile: await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', luca.userId))
      .unique(),
    sessions: await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', luca.userId))
      .collect(),
    messages: await ctx.db.query('messages').collect(),
  }));
  expect(left).toEqual({ user: null, profile: null, sessions: [], messages: [] });
  // The token Luca still holds no longer works.
  await expect(luca.as.mutation(api.queue.joinQueue, {})).rejects.toThrow('Sign in first.');
});

type Player = Awaited<ReturnType<typeof player>>;

/** Lena picks, everyone still in answers, and Lena pops `loser`. */
async function playRound(lena: Player, roomId: string, answering: Player[], loser: Player) {
  await pickFirstQuestion(lena, roomId);
  for (const p of answering) await p.as.mutation(api.rooms.postAnswer, { roomId, text: p.id });
  await lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: loser.id });
}

async function historyOf(p: Player, roomId: string) {
  const rooms = await p.as.query(api.history.list, {});
  return rooms.find((room) => room.roomId === roomId)!;
}

test('a block hides the match from both people until it is lifted', async () => {
  const { lena, luca, noah, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'A' });
  await noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'B' });
  await lena.as.mutation(api.rooms.popBalloon, { roomId, contestantId: noah.id });
  const matchId = (await view(lena, roomId)).matchId!;

  await luca.as.mutation(api.safety.block, { userId: lena.id });
  for (const person of [lena, luca]) {
    expect(await person.as.query(api.matches.list, {})).toEqual([]);
    expect(await person.as.query(api.matches.get, { matchId })).toBeNull();
  }

  await luca.as.mutation(api.safety.unblock, { userId: lena.id });
  for (const person of [lena, luca]) {
    expect(await person.as.query(api.matches.list, {})).toHaveLength(1);
  }
});

test('only the chooser and the winner see the match in their history, and unmatching keeps the outcome', async () => {
  const { lena, luca, noah, roomId } = await startRoom();
  await playRound(lena, roomId, [luca, noah], noah);

  expect(await historyOf(lena, roomId)).toMatchObject({ outcome: 'chose', matchName: 'Luca' });
  expect(await historyOf(luca, roomId)).toMatchObject({ outcome: 'won', matchName: 'Lena' });
  const popped = await historyOf(noah, roomId);
  expect(popped).toMatchObject({ outcome: 'popped', poppedInRound: 1, matchId: null, matchName: null });

  const matchId = (await historyOf(lena, roomId)).matchId!;
  await lena.as.mutation(api.matches.unmatch, { matchId });
  expect(await historyOf(lena, roomId)).toMatchObject({ outcome: 'chose', matchId: null, matchName: null });
  expect(await historyOf(luca, roomId)).toMatchObject({ outcome: 'won', matchId: null, matchName: null });
});

test('history keeps a pop that came before leaving, and tells it apart from leaving while still in', async () => {
  process.env.LOBBY_SIZE = '4';
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'man');
  const luca = await player(t, 'Luca', 'man', 'woman');
  const noah = await player(t, 'Noah', 'man', 'woman');
  const ben = await player(t, 'Ben', 'man', 'woman');
  for (const p of [lena, luca, noah, ben]) await p.as.mutation(api.queue.joinQueue, {});
  const status = await lena.as.query(api.queue.status, {});
  const roomId = status.state === 'matched' ? status.roomId : '';

  await playRound(lena, roomId, [luca, noah, ben], noah);
  // Noah taps "Play another room" after his pop; Ben walks out while still in.
  await noah.as.mutation(api.rooms.leaveRoom, { roomId });
  await ben.as.mutation(api.rooms.leaveRoom, { roomId });

  expect(await historyOf(noah, roomId)).toMatchObject({ outcome: 'popped', poppedInRound: 1 });
  expect(await historyOf(ben, roomId)).toMatchObject({ outcome: 'left', poppedInRound: 2 });
  expect(await historyOf(luca, roomId)).toMatchObject({ outcome: 'won' });
});

test('when the chooser leaves, contestants still in are popped in the round the room stopped', async () => {
  const { lena, luca, roomId } = await startRoom();
  await lena.as.mutation(api.rooms.leaveRoom, { roomId });
  expect(await historyOf(lena, roomId)).toMatchObject({ outcome: 'left' });
  expect(await historyOf(luca, roomId)).toMatchObject({
    outcome: 'popped',
    poppedInRound: 1,
    matchId: null,
  });
});

test('leaving the queue after a room formed keeps your seat and hands back the room', async () => {
  const { t, lena, roomId } = await startRoom();
  expect(await lena.as.mutation(api.queue.leaveQueue, {})).toBe(roomId);
  expect(await lena.as.query(api.queue.status, {})).toEqual({ state: 'matched', roomId });

  const mia = await player(t, 'Mia', 'woman', 'man');
  await mia.as.mutation(api.queue.joinQueue, {});
  expect(await mia.as.mutation(api.queue.leaveQueue, {})).toBeNull();
  expect(await mia.as.query(api.queue.status, {})).toEqual({ state: 'idle' });
});

test('the queue only counts people who could share a room with you', async () => {
  const t = convexTest(schema, modules);
  const women = [
    await player(t, 'Lena', 'woman', 'man'),
    await player(t, 'Mia', 'woman', 'man'),
    await player(t, 'Ava', 'woman', 'man'),
  ];
  for (const p of women) await p.as.mutation(api.queue.joinQueue, {});
  // Three women who want men can never fill a room together.
  expect(await women[0].as.query(api.queue.status, {})).toMatchObject({ found: 1, needed: 3 });

  const max = await player(t, 'Max', 'man', 'man');
  await max.as.mutation(api.queue.joinQueue, {});
  expect(await women[0].as.query(api.queue.status, {})).toMatchObject({ found: 1 });
  expect(await max.as.query(api.queue.status, {})).toMatchObject({ found: 1 });
});

test('the chooser is drawn from everyone in the lobby who fits the others', async () => {
  const t = convexTest(schema, modules);
  const lena = await player(t, 'Lena', 'woman', 'everyone');
  const mia = await player(t, 'Mia', 'woman', 'everyone');
  const ava = await player(t, 'Ava', 'woman', 'everyone');
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
  try {
    for (const p of [lena, mia, ava]) await p.as.mutation(api.queue.joinQueue, {});
  } finally {
    random.mockRestore();
  }
  const status = await lena.as.query(api.queue.status, {});
  const room = await view(ava, status.state === 'matched' ? status.roomId : '');
  // Not the longest-waiting player: the draw picked the last of the three.
  expect(room.me.role).toBe('popper');
});

test('answers sent just after the deadline still land during the grace', async () => {
  const { t, lena, luca, noah, roomId } = await startRoom();
  await pickFirstQuestion(lena, roomId);
  const deadline = (await view(lena, roomId)).deadline!;

  vi.advanceTimersByTime(ANSWER_MS + ANSWER_GRACE_MS / 2);
  await t.finishInProgressScheduledFunctions();
  expect((await view(lena, roomId)).status).toBe('answering');
  await luca.as.mutation(api.rooms.postAnswer, { roomId, text: 'Just in time' });
  // The deadline players see doesn't move.
  expect((await view(lena, roomId)).deadline).toBe(deadline);

  vi.advanceTimersByTime(ANSWER_GRACE_MS);
  await t.finishInProgressScheduledFunctions();
  expect((await view(lena, roomId)).status).toBe('popping');
  await expect(noah.as.mutation(api.rooms.postAnswer, { roomId, text: 'Too late' })).rejects.toThrow(
    'Answer time is over.',
  );
});

test('an idle chooser with no options still gets a question, and a room out of questions ends', async () => {
  const first = await startRoom();
  const roomId = await first.t.run(async (ctx) => ctx.db.normalizeId('rooms', first.roomId)!);
  await first.t.run(async (ctx) => {
    for (const question of await ctx.db.query('questions').collect()) {
      await ctx.db.patch(question._id, { active: false });
    }
    await ctx.db.patch(roomId, { questionOptionIds: [] });
  });
  vi.advanceTimersByTime(PICK_MS + 1);
  await first.t.finishInProgressScheduledFunctions();
  const asked = await view(first.lena, first.roomId);
  expect(asked.status).toBe('answering');
  expect(asked.question).not.toBeNull();

  const second = await startRoom();
  const stuckId = await second.t.run(async (ctx) => ctx.db.normalizeId('rooms', second.roomId)!);
  await second.t.run(async (ctx) => {
    const all = await ctx.db.query('questions').collect();
    await ctx.db.patch(stuckId, { questionOptionIds: [], usedQuestionIds: all.map((q) => q._id) });
  });
  vi.advanceTimersByTime(PICK_MS + 1);
  await second.t.finishInProgressScheduledFunctions();
  const ended = await view(second.lena, second.roomId);
  expect(ended.status).toBe('finished');
  expect(ended.winnerId).toBeNull();
});

test('a second chance can not be answered once it expired or after a block', async () => {
  const blocked = await startRoom();
  await playRound(blocked.lena, blocked.roomId, [blocked.luca, blocked.noah], blocked.noah);
  await blocked.lena.as.mutation(api.secondChances.send, {
    roomId: blocked.roomId,
    userId: blocked.noah.id,
  });
  const [incoming] = await blocked.noah.as.query(api.secondChances.list, {});
  expect(incoming.state).toBe('incoming');
  await blocked.lena.as.mutation(api.safety.block, { userId: blocked.noah.id });
  await expect(
    blocked.noah.as.mutation(api.secondChances.answer, { id: incoming.id, accept: true }),
  ).rejects.toThrow('That second chance is no longer open.');

  const late = await startRoom();
  await playRound(late.lena, late.roomId, [late.luca, late.noah], late.noah);
  await late.lena.as.mutation(api.secondChances.send, { roomId: late.roomId, userId: late.noah.id });
  const [chance] = await late.noah.as.query(api.secondChances.list, {});
  vi.advanceTimersByTime(8 * 24 * 60 * 60_000);
  expect(await late.noah.as.query(api.secondChances.list, {})).toEqual([]);
  await expect(
    late.noah.as.mutation(api.secondChances.answer, { id: chance.id, accept: true }),
  ).rejects.toThrow('That second chance has passed.');
});

test('signing out removes your push tokens', async () => {
  const { t, lena } = await startRoom();
  await t.run(async (ctx) => {
    await ctx.db.insert('pushTokens', { userId: lena.userId, token: 'ExponentPushToken[x]', updatedAt: 0 });
  });
  await lena.as.mutation(api.account.prepareSignOut, {});
  const tokens = await t.run(
    async (ctx) =>
      await ctx.db
        .query('pushTokens')
        .withIndex('by_user', (q) => q.eq('userId', lena.userId))
        .collect(),
  );
  expect(tokens).toEqual([]);
});

test('the chat loads only the newest 200 messages, oldest first', async () => {
  const { t, lena, luca, noah, roomId } = await startRoom();
  await playRound(lena, roomId, [luca, noah], noah);
  const matchId = (await view(lena, roomId)).matchId!;
  const id = await t.run(async (ctx) => ctx.db.normalizeId('matches', matchId)!);
  await t.run(async (ctx) => {
    for (let i = 0; i < 205; i++) {
      await ctx.db.insert('messages', { matchId: id, senderId: lena.userId, text: `m${i}`, sentAt: i });
    }
  });
  const messages = await luca.as.query(api.chat.list, { matchId });
  expect(messages).toHaveLength(200);
  expect(messages[0].text).toBe('m5');
  expect(messages[199].text).toBe('m204');
});
