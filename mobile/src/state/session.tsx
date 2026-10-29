import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, type Gender, type Interest, type Profile, type ProfileDraft } from '@/api';
import { readJson, removeJson, writeJson } from '@/utils/device-store';

/** Onboarding's answers, kept until the profile is saved, so a relaunch picks up there. */
const ONBOARDING_KEY = 'popdate.onboarding';
/** Profile setup's photos and fields, kept the same way. */
export const SETUP_DRAFT_KEY = 'popdate.setupDraft';

/** What onboarding collects before the profile screen. */
export type OnboardingAnswers = {
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarding, setOnboardingState] = useState<OnboardingAnswers | null>(null);

  function setOnboarding(answers: OnboardingAnswers | null) {
    setOnboardingState(answers);
    if (answers) void writeJson(ONBOARDING_KEY, answers);
    else void removeJson(ONBOARDING_KEY);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await api.signIn();
      const existing = await api.getMyProfile();
      // Still mid-sign-up: pick up where you left off.
      const saved = existing ? null : await readJson<OnboardingAnswers>(ONBOARDING_KEY);
      if (cancelled) return;
      setProfile(existing);
      if (saved) setOnboardingState(saved);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(details: ProfileDetails, answers = onboarding) {
    if (!answers) throw new Error('Finish onboarding first.');
    // Pinned answers live on the profile, not in the form: keep them through an edit.
    const saved = await api.saveProfile({ pinnedAnswers: profile?.pinnedAnswers, ...answers, ...details });
    setProfile(saved);
    // Signed up: nothing left to pick up after a relaunch.
    void removeJson(ONBOARDING_KEY);
    void removeJson(SETUP_DRAFT_KEY);
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
    setProfile(null);
    setOnboarding(null);
    // Start a fresh session, so the welcome screen works as on a first launch.
    await api.signIn();
  }

  const signOut = () => endSession(() => api.signOut());
  const deleteAccount = () => endSession(() => api.deleteAccount());

  return (
    <SessionContext
      value={{
        ready,
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
