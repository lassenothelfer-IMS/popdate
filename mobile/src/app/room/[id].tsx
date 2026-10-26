import { useLocalSearchParams } from 'expo-router';

import { GameRoomScreen } from '@/features/game/game-room-screen';

export default function RoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GameRoomScreen key={id} roomId={id} />;
}
