import { ConvexReactClient } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type {
  Balloons,
  Match,
  Message,
  PopdateApi,
  Profile,
  ProfileDraft,
  QueueStatus,
  ReportReason,
  Room,
  Settings,
  Unsubscribe,
  VerificationStatus,
} from '@/api/types';

/** What `ConvexAuthProvider` hands over through `useAuthActions()`. */
type AuthActions = {
  signIn: (provider: string) => Promise<unknown>;
  signOut: () => Promise<void>;
};

/** A 1×1 PNG that stands in for the dev test profile's `mock://` photos, which aren't real files. */
const PLACEHOLDER_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** How long signing in may wait on Convex Auth before it counts as failed. */
const AUTH_TIMEOUT = 15_000;

/** A file's type from its blob, or from the file name when the phone doesn't say. */
function imageType(uri: string, blob: Blob) {
  if (blob.type.startsWith('image/')) return blob.type;
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_TYPES[extension] ?? 'image/jpeg';
}

/** Server messages are written for players, so they pass through; anything else stays generic. */
function playerError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string') return new Error(error.data);
  return new Error('Something went wrong. Try again.');
}

/**
 * `PopdateApi` on the Convex backend in `convex/`. Screens use it exactly like
 * the mock. Signing in goes through Convex Auth, which only exists inside
 * `ConvexAuthProvider`, so `ApiProvider` attaches its actions here.
 */
export class ConvexServer implements PopdateApi {
  readonly client: ConvexReactClient;
  private actions: AuthActions | null = null;
  private auth = { loading: true, authenticated: false };
  private authListeners = new Set<() => void>();
  /** Photo URL to file id, so editing a profile resends kept photos instead of uploading them again. */
  private photoIds = new Map<string, string>();
  /** Uploads started as photos were picked, by their local URI. */
  private pendingUploads = new Map<string, { upload: Promise<Id<'_storage'>>; cancel: () => void }>();

  constructor(url: string) {
    this.client = new ConvexReactClient(url, { unsavedChangesWarning: false });
  }

  // Wiring from ApiProvider

  attach(actions: AuthActions) {
    this.actions = actions;
    this.notifyAuth();
  }

  setAuthState(loading: boolean, authenticated: boolean) {
    this.auth = { loading, authenticated };
    this.notifyAuth();
  }

  private notifyAuth() {
    this.authListeners.forEach((listener) => listener());
  }

  /** Waits for Convex Auth to reach a state, and gives up after a while, so a sign-in never hangs. */
  private waitForAuth(check: (auth: { loading: boolean; authenticated: boolean }) => boolean) {
    const done = () => this.actions !== null && check(this.auth);
    if (done()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.authListeners.delete(listener);
        reject(new Error("Couldn't sign in. Try again."));
      }, AUTH_TIMEOUT);
      const listener = () => {
        if (!done()) return;
        clearTimeout(timer);
        this.authListeners.delete(listener);
        resolve();
      };
      this.authListeners.add(listener);
    });
  }

  // Calls

  private async query<Q extends FunctionReference<'query'>>(query: Q, args: Q['_args']) {
    try {
      return (await this.client.query(query, args)) as Q['_returnType'];
    } catch (error) {
      throw playerError(error);
    }
  }

  private async mutation<M extends FunctionReference<'mutation'>>(mutation: M, args: M['_args']) {
    try {
      return (await this.client.mutation(mutation, args)) as M['_returnType'];
    } catch (error) {
      throw playerError(error);
    }
  }

  /** Calls `onValue` with every new result of a live query. */
  private watch<Q extends FunctionReference<'query'>>(
    query: Q,
    args: Q['_args'],
    onValue: (value: Q['_returnType']) => void,
    onError: () => void = () => {},
  ): Unsubscribe {
    const watch = this.client.watchQuery(query, args);
    const emit = () => {
      try {
        const value = watch.localQueryResult();
        if (value !== undefined) onValue(value as Q['_returnType']);
      } catch {
        onError();
      }
    };
    const unsubscribe = watch.onUpdate(emit);
    emit();
    return unsubscribe;
  }

  preparePhoto(uri: string) {
    if (this.pendingUploads.has(uri) || this.photoIds.has(uri)) return;
    const controller = new AbortController();
    const upload = this.upload(uri, controller.signal);
    const pending = { upload, cancel: () => controller.abort() };
    this.pendingUploads.set(uri, pending);
    // A failed early upload is forgotten, and saving tries that photo again.
    upload.catch(() => {
      if (this.pendingUploads.get(uri) === pending) this.pendingUploads.delete(uri);
    });
  }

  /**
   * Drops the early uploads of photos that are no longer in the form (removed,
   * or past the last slot), so they stop using the phone's data. Not part of
   * `PopdateApi`: the mock has nothing to drop.
   */
  forgetPhotos(keep: readonly string[]) {
    for (const [uri, pending] of this.pendingUploads) {
      if (keep.includes(uri)) continue;
      pending.cancel();
      this.pendingUploads.delete(uri);
    }
  }

  /** Uploads one local photo to Convex file storage and returns its file id. */
  private async upload(uri: string, signal?: AbortSignal): Promise<Id<'_storage'>> {
    const uploadUrl = await this.mutation(api.profiles.generateUploadUrl, {});
    const source = uri.startsWith('mock://') ? PLACEHOLDER_PHOTO : await shrinkPhoto(uri, signal);
    if (signal?.aborted) throw new Error('The photo was removed.');
    const blob = await (await fetch(source)).blob();
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': imageType(source, blob) },
      body: blob,
      signal,
    });
    if (!response.ok) throw new Error('A photo did not upload. Try again.');
    const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
    return storageId;
  }

  // Account

  async signIn() {
    await this.waitForAuth((auth) => !auth.loading);
    if (this.auth.authenticated) {
      const id = await this.query(api.users.me, {});
      if (id) return id;
      // The saved session belongs to a deleted account: start over.
      await this.actions!.signOut();
      await this.waitForAuth((auth) => !auth.loading && !auth.authenticated);
    }
    await this.actions!.signIn('anonymous');
    await this.waitForAuth((auth) => !auth.loading && auth.authenticated);
    const id = await this.query(api.users.me, {});
    if (!id) throw new Error("Couldn't sign in. Try again.");
    return id;
  }

  async signOut() {
    await this.mutation(api.account.prepareSignOut, {}).catch(() => {});
    await this.endSession();
  }

  async deleteAccount() {
    await this.mutation(api.account.deleteAccount, {});
    await this.endSession();
  }

  private async endSession() {
    // The server session may already be gone (after a delete); the tokens on the phone go either way.
    await this.actions?.signOut().catch(() => {});
    await this.waitForAuth((auth) => !auth.loading && !auth.authenticated);
    this.photoIds.clear();
    // Uploads still under way belonged to the old account: stop them.
    this.forgetPhotos([]);
  }

  async getMyProfile(): Promise<Profile | null> {
    const profile = await this.query(api.profiles.getMine, {});
    return profile ? this.keepPhotoIds(profile) : null;
  }

  async saveProfile(draft: ProfileDraft): Promise<Profile> {
    this.forgetPhotos(draft.photos);
    const photos = await Promise.all(
      draft.photos.map(
        async (uri) =>
          (this.photoIds.get(uri) as Id<'_storage'>) ??
          this.pendingUploads.get(uri)?.upload ??
          this.upload(uri),
      ),
    );
    const saved = await this.mutation(api.profiles.saveProfile, {
      name: draft.name,
      birthDate: draft.birthDate,
      gender: draft.gender,
      wantsToMeet: draft.wantsToMeet,
      city: draft.city,
      heightCm: draft.heightCm ?? undefined,
      job: draft.job,
      bio: draft.bio,
      genderIdentity: draft.genderIdentity,
      genderDetails: draft.genderDetails,
      sexuality: draft.sexuality,
      pinnedAnswers: draft.pinnedAnswers,
      photos,
    }).catch((error: unknown) => {
      // An early upload left unsaved for a day is swept from storage: upload those again next time.
      for (const uri of draft.photos) this.pendingUploads.delete(uri);
      throw error;
    });
    return this.keepPhotoIds(saved);
  }

  private keepPhotoIds({ photoIds, ...profile }: Profile & { photoIds: string[] }): Profile {
    profile.photos.forEach((url, index) => this.photoIds.set(url, photoIds[index]));
    return profile;
  }

  // Queue

  async joinQueue() {
    await this.mutation(api.queue.joinQueue, {});
  }

  async leaveQueue() {
    // The room you were already seated in when a lobby formed, or null when you're out.
    const roomId: unknown = await this.mutation(api.queue.leaveQueue, {});
    return typeof roomId === 'string' ? roomId : null;
  }

  watchConnection(onChange: (online: boolean) => void) {
    // Offline only once it had connected and then lost the socket; a first connect is just loading.
    const update = () => {
      const state = this.client.connectionState();
      onChange(state.isWebSocketConnected || !state.hasEverConnected);
    };
    update();
    return this.client.subscribeToConnectionState(update);
  }

  async getActiveRoom() {
    return this.query(api.rooms.active, {});
  }

  watchQueue(onChange: (status: QueueStatus) => void) {
    return this.watch(api.queue.status, {}, onChange);
  }

  async pingQueue() {
    await this.mutation(api.queue.pingQueue, {});
  }

  watchBalloons(onChange: (balloons: Balloons | null) => void) {
    return this.watch(api.balloons.mine, {}, onChange);
  }

  async balloonsBought(_productId: string) {
    // RevenueCat's webhook credits the pack on the server (convex/http.ts), and the
    // balloons query updates by itself. Trusting the app here would let anyone add balloons.
  }

  // Rooms

  watchRoom(roomId: string, onChange: (room: Room | null) => void) {
    return this.watch(api.rooms.get, { roomId }, onChange, () => onChange(null));
  }

  async pickQuestion(roomId: string, questionId: string) {
    await this.mutation(api.rooms.pickQuestion, { roomId, questionId });
  }

  async postAnswer(roomId: string, text: string) {
    await this.mutation(api.rooms.postAnswer, { roomId, text });
  }

  async popBalloon(roomId: string, contestantId: string) {
    await this.mutation(api.rooms.popBalloon, { roomId, contestantId });
  }

  async leaveRoom(roomId: string) {
    await this.mutation(api.rooms.leaveRoom, { roomId });
  }

  // Matches

  async listMatches(): Promise<Match[]> {
    return await this.query(api.matches.list, {});
  }

  async getMatch(matchId: string): Promise<Match | null> {
    return await this.query(api.matches.get, { matchId });
  }

  async unmatch(matchId: string) {
    await this.mutation(api.matches.unmatch, { matchId });
  }

  async listRoomHistory() {
    return await this.query(api.history.list, {});
  }

  async getQueueStats() {
    return await this.query(api.queue.stats, {});
  }

  async listSecondChances() {
    return await this.query(api.secondChances.list, {});
  }

  async sendSecondChance(roomId: string, userId: string) {
    await this.mutation(api.secondChances.send, { roomId, userId });
  }

  async answerSecondChance(id: string, accept: boolean) {
    const matchId = await this.mutation(api.secondChances.answer, { id, accept });
    return matchId ? await this.getMatch(matchId) : null;
  }

  // Settings

  async getSettings(): Promise<Settings> {
    return await this.query(api.settings.get, {});
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    return await this.mutation(api.settings.save, settings);
  }

  async registerPushToken(token: string) {
    await this.mutation(api.settings.registerPushToken, { token });
  }

  // Verification

  async getVerification(): Promise<VerificationStatus> {
    return await this.query(api.verification.get, {});
  }

  async submitSelfie(photoUri: string): Promise<VerificationStatus> {
    if (!photoUri) throw new Error('Take a selfie first.');
    const selfie = await this.upload(photoUri);
    return await this.mutation(api.verification.submitSelfie, { selfie });
  }

  // Safety

  async listBlocked() {
    return await this.query(api.safety.listBlocked, {});
  }

  async block(userId: string) {
    await this.mutation(api.safety.block, { userId });
  }

  async unblock(userId: string) {
    await this.mutation(api.safety.unblock, { userId });
  }

  async report(userId: string, reason: ReportReason, details?: string) {
    await this.mutation(api.safety.report, { userId, reason, details });
  }

  // Chat

  async listMessages(matchId: string): Promise<Message[]> {
    return await this.query(api.chat.list, { matchId });
  }

  watchMessages(matchId: string, onChange: (messages: Message[]) => void, onError?: () => void) {
    return this.watch(api.chat.list, { matchId }, onChange, () => (onError ? onError() : onChange([])));
  }

  async sendMessage(matchId: string, text: string, replyTo?: string): Promise<Message> {
    return await this.mutation(api.chat.send, { matchId, text, replyTo });
  }

  async sendVoice(
    matchId: string,
    recording: { uri: string; durationMs: number; waveform: number[] },
    replyTo?: string,
  ): Promise<Message> {
    const uploadUrl = await this.mutation(api.profiles.generateUploadUrl, {});
    const blob = await (await fetch(recording.uri)).blob();
    const response = await fetch(uploadUrl, {
      method: 'POST',
      // Phones record AAC in an MP4 container; a blob read from a file may not say so.
      headers: { 'Content-Type': blob.type.startsWith('audio/') ? blob.type : 'audio/mp4' },
      body: blob,
    });
    if (!response.ok) throw new Error('Your voice message did not upload. Try again.');
    const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
    return await this.mutation(api.chat.sendVoice, {
      matchId,
      storageId,
      durationMs: recording.durationMs,
      waveform: recording.waveform,
      replyTo,
    });
  }

  async reactToMessage(matchId: string, messageId: string, emoji: string | null) {
    await this.mutation(api.chat.react, { matchId, messageId, emoji });
  }

  async setTyping(matchId: string) {
    await this.mutation(api.chat.typing, { matchId });
  }

  watchTyping(matchId: string, onChange: (typedAt: number | null) => void) {
    return this.watch(api.chat.typingOf, { matchId }, onChange, () => onChange(null));
  }
}

/** Photos are shown at most this wide, so nothing wider is uploaded. */
const PHOTO_MAX_WIDTH = 1440;
/** Photos shrunk at the same time. Each decode of a 12 MP original is large, so six at once can run out of memory. */
const SHRINK_AT_ONCE = 2;

let shrinking = 0;
const waitingToShrink: (() => void)[] = [];

/** Runs `task` once one of the shrink slots is free; a finished task hands its slot to the next. */
async function inShrinkTurn<T>(task: () => Promise<T>): Promise<T> {
  if (shrinking < SHRINK_AT_ONCE) shrinking++;
  else await new Promise<void>((resolve) => waitingToShrink.push(resolve));
  try {
    return await task();
  } finally {
    const next = waitingToShrink.shift();
    if (next) next();
    else shrinking--;
  }
}

/**
 * A picked photo as a JPEG at most 1440 px wide: around 300 KB instead of a
 * 3 MB HEIC original, so a profile uploads quickly even on mobile data. The
 * original is downsampled while it's decoded, so it's never in memory at full
 * size. One that can't be read is tried once more, then fails: uploading the
 * original instead would send a huge HEIC.
 */
async function shrinkPhoto(uri: string, signal?: AbortSignal): Promise<string> {
  return inShrinkTurn(async () => {
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw new Error('The photo was removed.');
      try {
        const image = await ImageManipulator.manipulate(uri, { maxWidth: PHOTO_MAX_WIDTH }).renderAsync();
        try {
          const { uri: shrunk } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
          return shrunk;
        } finally {
          image.release();
        }
      } catch {
        if (attempt >= 2) throw new Error("A photo couldn't be read. Try another one.");
      }
    }
  });
}
