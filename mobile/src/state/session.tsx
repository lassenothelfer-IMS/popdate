import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, type Gender, type Interest, type Profile, type ProfileDraft } from '@/api';
import { removeUnusedPhotos } from '@/features/profile/photo-files';
import { identify } from '@/utils/analytics';
import { readJson, removeJson, writeJson } from '@/utils/device-store';
import { setPurchasesUser } from '@/utils/purchases';
import { registerPushIfAllowed } from '@/utils/push';
import { resetRoomsPlayed } from '@/utils/rooms-played';

/** Onboarding's answers, kept until the profile is saved, so a relaunch picks up there. */
const ONBOARDING_KEY = 'popdate.onboarding';
/** Profile setup's photos and fields, kept the same way. */
export const SETUP_DRAFT_KEY = 'popdate.setupDraft';
/** How long signing in may take before the app says so and offers to try again. */
const SIGN_IN_TIMEOUT = 15_000;

/** `promise`, or a rejection once it has taken longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Couldn't sign in. Try again.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** What onboarding collects before the profile screen. */
export type OnboardingAnswers = {
  /** Your first name, asked first. It goes on the profile as its name. */
  firstName?: string;
  birthDate: string;
  gender: Gender;
  wantsToMeet: Interest;
  /** How you describe your gender. `gender` above is the side of the room it plays on. */
  genderIdentity?: string;
  termsAcceptedAt: string;
};

export type ProfileDetails = Omit<ProfileDraft, keyof OnboardingAnswers>;

type Session = {
  ready: boolean;
  /** Signing in failed or took too long: nothing works until `retry` gets through. */
  failed: boolean;
  /** Tries signing in again after a failure. */
  retry: () => void;
  /** Whether this phone is signed in to an account. False until Sign in with Apple. */
  signedIn: boolean;
  /** Signs in with the identity token Apple gave the phone. Resolves with whether a profile already exists. */
  signInWithApple: (identityToken: string) => Promise<boolean>;
  /** A throwaway test account, for development builds and the web preview. */
  signInAsGuest: () => Promise<boolean>;
  profile: Profile | null;
  onboarding: OnboardingAnswers | null;
  setOnboarding: (answers: OnboardingAnswers | null) => void;
  saveProfile: (details: ProfileDetails, answers?: OnboardingAnswers) => Promise<Profile>;
  /** Changes part of your saved profile, like your pinned answers. */
  updateProfile: (patch: Partial<ProfileDraft>) => Promise<Profile>;
  /** Ends the session; the app goes back to the welcome screen. */
  signOut: () => Promise<void>;
  /** Deletes the account for good; the app goes back to the welcome screen. */
  deleteAccount: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bumped by retry, which runs the sign-in again.
  const [attempt, setAttempt] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [onboarding, setOnboardingState] = useState<OnboardingAnswers | null>(null);

  function setOnboarding(answers: OnboardingAnswers | null) {
    setOnboardingState(answers);
    if (answers) void writeJson(ONBOARDING_KEY, answers);
    else void removeJson(ONBOARDING_KEY);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId, existing, saved } = await withTimeout(
          (async () => {
            // Nobody signed in: the welcome screen, and Sign in with Apple from there.
            const userId = await api.resume();
            if (!userId) return { userId, existing: null, saved: null };
            // Events from here on belong to this account. Only its id, nothing personal.
            identify(userId);
            // So does Popdate+: bought on this account, it follows the account.
            setPurchasesUser(userId);
            const existing = await api.getMyProfile();
            // Still mid-sign-up: pick up where you left off.
            const saved = existing ? null : await readJson<OnboardingAnswers>(ONBOARDING_KEY);
            return { userId, existing, saved };
          })(),
          SIGN_IN_TIMEOUT,
        );
        if (cancelled) return;
        setSignedIn(userId !== null);
        setProfile(existing);
        if (saved) setOnboardingState(saved);
        setReady(true);
        // Push already allowed: make sure this account gets them.
        if (userId) void registerPushIfAllowed();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setFailed(false);
    setReady(false);
    setAttempt((count) => count + 1);
  }

  /** After any sign-in: the account's id goes to analytics and purchases, then its profile is read. */
  async function signedInAs(userId: string) {
    identify(userId);
    setPurchasesUser(userId);
    const existing = await api.getMyProfile();
    setProfile(existing);
    setSignedIn(true);
    void registerPushIfAllowed();
    return existing !== null;
  }

  async function signInWithApple(identityToken: string) {
    return signedInAs(await withTimeout(api.signInWithApple(identityToken), SIGN_IN_TIMEOUT));
  }

  async function signInAsGuest() {
    return signedInAs(await withTimeout(api.signIn(), SIGN_IN_TIMEOUT));
  }

  async function saveProfile(details: ProfileDetails, answers = onboarding) {
    if (!answers) throw new Error('Finish onboarding first.');
    // The first name rides with onboarding's answers but is saved as the profile's name.
    const { firstName: _firstName, ...rest } = answers;
    // Pinned answers live on the profile, not in the form: keep them through an edit.
    const saved = await api.saveProfile({ pinnedAnswers: profile?.pinnedAnswers, ...rest, ...details });
    setProfile(saved);
    // Signed up: nothing left to pick up after a relaunch.
    void removeJson(ONBOARDING_KEY);
    void removeJson(SETUP_DRAFT_KEY);
    // The picked photos' copies are uploaded now (or, on the mock, kept as the saved ones).
    removeUnusedPhotos(saved.photos);
    return saved;
  }

  async function updateProfile(patch: Partial<ProfileDraft>) {
    if (!profile) throw new Error('Finish your profile first.');
    const { id: _id, ...draft } = profile;
    const saved = await api.saveProfile({ ...draft, ...patch });
    setProfile(saved);
    return saved;
  }

  async function endSession(action: () => Promise<void>) {
    await action();
    identify(null);
    setPurchasesUser(null);
    setProfile(null);
    setOnboarding(null);
    // Hints such as "Swipe through the five" belong to the account, not the phone.
    void resetRoomsPlayed();
    // Back to the welcome screen, signed out, as on a first launch.
    setSignedIn(false);
  }

  const signOut = () => endSession(() => api.signOut());
  const deleteAccount = () => endSession(() => api.deleteAccount());

  return (
    <SessionContext
      value={{
        ready,
        failed,
        retry,
        signedIn,
        signInWithApple,
        signInAsGuest,
        profile,
        onboarding,
        setOnboarding,
        saveProfile,
        updateProfile,
        signOut,
        deleteAccount,
      }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
