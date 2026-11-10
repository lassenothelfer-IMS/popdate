import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Balloons, ProfileDraft, Room } from '@/api/types';
import { FREE_BALLOONS, STARTER_BALLOONS } from '@/shared/balloons';

// The device store reaches for the keychain through React Native; the mock
// server only needs somewhere to keep JSON, so a map stands in for it.
vi.mock('@/utils/device-store', () => {
  const store = new Map<string, unknown>();
  return {
    readJson: async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null),
    writeJson: async (key: string, value: unknown) => void store.set(key, structuredClone(value)),
    removeJson: async (key: string) => void store.delete(key),
  };
});

const { mockServer } = await import('@/api/mock-server');

const DRAFT: ProfileDraft = {
  name: 'Alex',
  birthDate: '1998-04-12',
  gender: 'woman',
  wantsToMeet: 'man',
  city: 'Zürich',
  heightCm: 170,
  job: '',
  bio: '',
  photos: ['p1', 'p2', 'p3', 'p4'],
  termsAcceptedAt: '2026-01-01T00:00:00.000Z',
};

/** Joins the line and waits until a room forms, then follows it. */
async function playRoom(role: 'popper' | 'contestant') {
  mockServer.nextRole = role;
  await mockServer.joinQueue();
  await vi.advanceTimersByTimeAsync(700 * 6);
  const roomId = await mockServer.getActiveRoom();
  expect(roomId).not.toBeNull();
  const views: Room[] = [];
  const stop = mockServer.watchRoom(roomId!, (next) => {
    if (next) views.push(next);
  });
  return { roomId: roomId!, room: () => views.at(-1)!, views, stop };
}

beforeEach(async () => {
  vi.useFakeTimers();
  await mockServer.deleteAccount();
  await mockServer.signIn();
});

afterEach(async () => {
  await mockServer.deleteAccount();
  vi.useRealTimers();
});

describe('mock server', () => {
  describe('profile', () => {
    it('needs 4 to 6 photos', async () => {
      await expect(mockServer.saveProfile({ ...DRAFT, photos: ['a', 'b', 'c'] })).rejects.toThrow();
      await expect(mockServer.saveProfile({ ...DRAFT, photos: Array(7).fill('a') })).rejects.toThrow();
      await expect(mockServer.saveProfile(DRAFT)).resolves.toMatchObject({ name: 'Alex' });
    });

    it('turns away anyone under 18', async () => {
      const birthDate = `${new Date().getFullYear() - 17}-01-01`;
      await expect(mockServer.saveProfile({ ...DRAFT, birthDate })).rejects.toThrow();
    });

    it('needs a profile before you can join the line', async () => {
      await expect(mockServer.joinQueue()).rejects.toThrow();
    });
  });

  describe('rooms', () => {
    beforeEach(async () => {
      await mockServer.saveProfile(DRAFT);
    });

    it('forms a room of one chooser and five balloons once six people are in line', async () => {
      const statuses: string[] = [];
      const stopQueue = mockServer.watchQueue((status) => statuses.push(status.state));
      const { room, stop } = await playRoom('popper');
      expect(statuses).toContain('searching');
      expect(statuses.at(-1)).toBe('matched');
      expect(room().contestants).toHaveLength(5);
      expect(room().totalRounds).toBe(4);
      expect(room().me.role).toBe('popper');
      stop();
      stopQueue();
    });

    it('plays four rounds as the chooser and matches you with the last balloon', async () => {
      const { roomId, room, stop } = await playRoom('popper');
      for (let round = 1; round <= 4; round++) {
        expect(room().status).toBe('picking');
        expect(room().round).toBe(round);
        expect(room().questionOptions).toHaveLength(5);
        await expect(mockServer.popBalloon(roomId, room().contestants[0].id)).rejects.toThrow();

        await mockServer.pickQuestion(roomId, room().questionOptions[0].id);
        expect(room().status).toBe('answering');
        await expect(mockServer.pickQuestion(roomId, 'q1')).rejects.toThrow();

        // The bots answer within 15 seconds; then it's time to pop.
        await vi.advanceTimersByTimeAsync(15_000);
        expect(room().status).toBe('popping');
        const active = room().contestants.filter((c) => !c.popped);
        expect(active).toHaveLength(6 - round);
        expect(active.every((c) => c.answer)).toBe(true);

        await mockServer.popBalloon(roomId, active[0].id);
        await expect(mockServer.popBalloon(roomId, active[0].id)).rejects.toThrow();
      }

      const last = room().contestants.find((c) => !c.popped)!;
      expect(room().status).toBe('finished');
      expect(room().winnerId).toBe(last.id);
      expect(room().matchId).not.toBeNull();
      const matches = await mockServer.listMatches();
      expect(matches.map((m) => m.other.id)).toEqual([last.id]);
      const [history] = await mockServer.listRoomHistory();
      expect(history).toMatchObject({ role: 'popper', outcome: 'chose', matchName: last.name });
      stop();
    });

    it('pops a random balloon when the chooser waits too long', async () => {
      const { roomId, room, stop } = await playRoom('popper');
      await mockServer.pickQuestion(roomId, room().questionOptions[0].id);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(room().status).toBe('popping');
      await vi.advanceTimersByTimeAsync(32_500);
      expect(room().popReminder).toBe(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(room().contestants.filter((c) => c.popped)).toHaveLength(1);
      expect(room().round).toBe(2);
      stop();
    });

    it('lets a balloon answer once per round, filtered, and hides the others until popping', async () => {
      const { roomId, room, views, stop } = await playRoom('contestant');
      expect(room().me.role).toBe('contestant');
      await expect(mockServer.pickQuestion(roomId, 'q1')).rejects.toThrow();

      // The bot chooser picks within a few seconds.
      await vi.advanceTimersByTimeAsync(3_500);
      expect(room().status).toBe('answering');
      await expect(mockServer.postAnswer(roomId, '   ')).rejects.toThrow();
      await expect(mockServer.postAnswer(roomId, 'x'.repeat(281))).rejects.toThrow();

      await mockServer.postAnswer(roomId, 'Honestly, shit coffee');
      await expect(mockServer.postAnswer(roomId, 'Again')).rejects.toThrow();
      const me = room().contestants.find((c) => c.id === room().me.id)!;
      expect(me.answer).toBe('Honestly, •••• coffee');
      // No bot has answered yet: they take at least 3 seconds after the pick.
      expect(room().status).toBe('answering');
      expect(room().contestants.filter((c) => c.id !== me.id).every((c) => c.answer === null)).toBe(true);

      // Once popping starts, everyone's answer shows.
      await vi.advanceTimersByTimeAsync(15_000);
      const popping = views.find((view) => view.status === 'popping')!;
      expect(popping.contestants.every((c) => c.answer)).toBe(true);
      stop();
    });

    it('still takes an answer sent just after time is up', async () => {
      const { roomId, room, stop } = await playRoom('contestant');
      await vi.advanceTimersByTimeAsync(3_500);
      expect(room().status).toBe('answering');
      await vi.advanceTimersByTimeAsync(room().deadline! - Date.now() + 1_000);
      expect(room().status).toBe('popping');
      await expect(mockServer.postAnswer(roomId, 'Late but here')).resolves.toBeUndefined();
      stop();
    });

    it('ends the room with no match when you choose and never pick or pop', async () => {
      const { room, stop } = await playRoom('popper');
      await vi.advanceTimersByTimeAsync(30_000 + 60_000 + 3_000 + 30_000 + 30_000 + 1000);
      expect(room()).toMatchObject({ status: 'finished', winnerId: null, matchId: null });
      expect(await mockServer.listMatches()).toEqual([]);
      stop();
    });

    it('lets you leave the line before the room forms', async () => {
      await mockServer.joinQueue();
      await expect(mockServer.leaveQueue()).resolves.toBeNull();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await mockServer.getActiveRoom()).toBeNull();
    });

    it('counts leaving mid-room as left', async () => {
      const { roomId, stop } = await playRoom('contestant');
      await mockServer.leaveRoom(roomId);
      expect(await mockServer.getActiveRoom()).toBeNull();
      const [history] = await mockServer.listRoomHistory();
      expect(history).toMatchObject({ role: 'contestant', outcome: 'left' });
      stop();
    });
  });

  describe('balloons', () => {
    beforeEach(async () => {
      await mockServer.saveProfile(DRAFT);
    });

    function current() {
      let latest: Balloons | null = null;
      mockServer.watchBalloons((next) => (latest = next))();
      return latest!;
    }

    it('starts with the free and starter balloons, and leaving a room while in costs one', async () => {
      expect(current()).toMatchObject({ free: FREE_BALLOONS, extra: STARTER_BALLOONS, plus: false });
      const { roomId, stop } = await playRoom('contestant');
      await mockServer.leaveRoom(roomId);
      expect(current().free).toBe(FREE_BALLOONS - 1);
      stop();
    });

    it('never charges the chooser', async () => {
      const { roomId, stop } = await playRoom('popper');
      await mockServer.leaveRoom(roomId);
      expect(current()).toMatchObject({ free: FREE_BALLOONS, extra: STARTER_BALLOONS });
      stop();
    });

    it('spends nothing with Popdate+, as RevenueCat reports it', async () => {
      mockServer.setPlus(true);
      expect(current().plus).toBe(true);
      const { roomId, stop } = await playRoom('contestant');
      await mockServer.leaveRoom(roomId);
      expect(current()).toMatchObject({ free: FREE_BALLOONS, extra: STARTER_BALLOONS });
      mockServer.setPlus(false);
      stop();
    });

    it('keeps you out of the line with none left, until a pack lands', async () => {
      for (let i = 0; i < FREE_BALLOONS + STARTER_BALLOONS; i++) {
        const { roomId, stop } = await playRoom('contestant');
        await mockServer.leaveRoom(roomId);
        stop();
      }
      expect(current()).toMatchObject({ free: 0, extra: 0 });
      await expect(mockServer.joinQueue()).rejects.toThrow('No balloons left.');

      await mockServer.balloonsBought('popdate.balloons.5');
      await mockServer.balloonsBought('not.a.pack');
      expect(current().extra).toBe(5);
      await mockServer.joinQueue();
      await mockServer.leaveQueue();
    });
  });

  describe('safety', () => {
    it('blocks someone and stops your chat with them', async () => {
      await mockServer.saveProfile(DRAFT);
      const { roomId, room, stop } = await playRoom('popper');
      for (let round = 1; round <= 4; round++) {
        await mockServer.pickQuestion(roomId, room().questionOptions[0].id);
        await vi.advanceTimersByTimeAsync(15_000);
        await mockServer.popBalloon(roomId, room().contestants.find((c) => !c.popped)!.id);
      }
      const [match] = await mockServer.listMatches();
      await mockServer.sendMessage(match.id, 'Hi!');

      await mockServer.block(match.other.id);
      expect((await mockServer.listBlocked()).map((p) => p.id)).toEqual([match.other.id]);
      await expect(mockServer.sendMessage(match.id, 'Still there?')).rejects.toThrow();
      // The match and the chat are hidden while the block stands.
      expect(await mockServer.listMatches()).toEqual([]);
      expect(await mockServer.getMatch(match.id)).toBeNull();
      expect(await mockServer.listMessages(match.id)).toEqual([]);

      await mockServer.unblock(match.other.id);
      expect(await mockServer.listMatches()).toHaveLength(1);
      await expect(mockServer.sendMessage(match.id, 'Sorry')).resolves.toMatchObject({ text: 'Sorry' });
      stop();
    });

    it('needs a reason to report someone', async () => {
      await expect(mockServer.report('someone', '' as never)).rejects.toThrow();
    });
  });

  describe('account', () => {
    it('forgets everything when you delete your account', async () => {
      await mockServer.saveProfile(DRAFT);
      await mockServer.saveSettings({ ...(await mockServer.getSettings()), units: 'imperial' });
      await mockServer.deleteAccount();
      expect(await mockServer.getMyProfile()).toBeNull();
      expect((await mockServer.getSettings()).units).toBe('metric');
      expect(await mockServer.listMatches()).toEqual([]);
      expect(await mockServer.listRoomHistory()).toEqual([]);
    });
  });
});
