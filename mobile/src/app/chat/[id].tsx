import { useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '@/features/chat/chat-screen';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatScreen key={id} matchId={id} />;
}
