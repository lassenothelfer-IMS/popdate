import { ConvexReactClient } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';

import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type {
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

  private waitForAuth(check: (auth: { loading: boolean; authenticated: boolean }) => boolean) {
    const done = () => this.actions !== null && check(this.auth);
    if (done()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const listener = () => {
        if (!done()) return;
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

  /** Uploads one local photo to Convex file storage and returns its file id. */
  private async upload(uri: string): Promise<Id<'_storage'>> {
    const uploadUrl = await this.mutation(api.profiles.generateUploadUrl, {});
    const source = uri.startsWith('mock://') ? PLACEHOLDER_PHOTO : uri;
    const blob = await (await fetch(source)).blob();
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': imageType(source, blob) },
      body: blob,
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
  }

  async getMyProfile(): Promise<Profile | null> {
    const profile = await this.query(api.profiles.getMine, {});
    return profile ? this.keepPhotoIds(profile) : null;
  }

  async saveProfile(draft: ProfileDraft): Promise<Profile> {
    const photos = await Promise.all(
      draft.photos.map(async (uri) => (this.photoIds.get(uri) as Id<'_storage'>) ?? this.upload(uri)),
    );
    const saved = await this.mutation(api.profiles.saveProfile, {
      name: draft.name,
      birthDate: draft.birthDate,
      gender: draft.gender,
      wantsToMeet: draft.wantsToMeet,
      city: draft.city,
      heightCm: draft.heightCm,
      job: draft.job,
      bio: draft.bio,
      photos,
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
    await this.mutation(api.queue.leaveQueue, {});
  }

  watchQueue(onChange: (status: QueueStatus) => void) {
    return this.watch(api.queue.status, {}, onChange);
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

  watchMessages(matchId: string, onChange: (messages: Message[]) => void) {
    return this.watch(api.chat.list, { matchId }, onChange, () => onChange([]));
  }

  async sendMessage(matchId: string, text: string): Promise<Message> {
    return await this.mutation(api.chat.send, { matchId, text });
  }
}
