import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, type Gender, type Profile, type ProfileDraft } from '@/api';

/** What onboarding collects before the profile screen. */
export type OnboardingAnswers = {
  birthDate: string;
  gender: Gender;
  wantsToMeet: Gender;
  termsAcceptedAt: string;
};

export type ProfileDetails = Omit<ProfileDraft, keyof OnboardingAnswers>;

type Session = {
  ready: boolean;
  profile: Profile | null;
  onboarding: OnboardingAnswers | null;
  setOnboarding: (answers: OnboardingAnswers) => void;
  saveProfile: (details: ProfileDetails, answers?: OnboardingAnswers) => Promise<Profile>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await api.signIn();
      const existing = await api.getMyProfile();
      if (cancelled) return;
      setProfile(existing);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(details: ProfileDetails, answers = onboarding) {
    if (!answers) throw new Error('Finish onboarding first.');
    const saved = await api.saveProfile({ ...answers, ...details });
    setProfile(saved);
    return saved;
  }

  return (
    <SessionContext value={{ ready, profile, onboarding, setOnboarding, saveProfile }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
