import { useLocalSearchParams } from 'expo-router';

import { MatchScreen } from '@/features/match/match-screen';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MatchScreen key={id} matchId={id} />;
}
