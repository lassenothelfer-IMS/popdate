import { Redirect } from 'expo-router';

import { useSession } from '@/state/session';

export default function Index() {
  const { ready, profile, onboarding } = useSession();
  if (!ready) return null;
  if (profile) return <Redirect href="/home" />;
  return <Redirect href={onboarding ? '/profile-setup' : '/onboarding'} />;
}
