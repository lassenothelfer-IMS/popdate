import { useLocalSearchParams } from 'expo-router';

import { RecapScreen } from '@/features/recap/recap-screen';

export default function RecapRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecapScreen key={id} roomId={id} />;
}
