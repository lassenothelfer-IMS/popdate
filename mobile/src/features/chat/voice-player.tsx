import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useEffectEvent } from 'react';

import { VoiceRow } from '@/features/chat/voice-row';
import { voiceTime, type VoiceNote } from '@/shared/chat';

/**
 * The voice message that is playing. This file needs the phone's audio module,
 * so it is only loaded where that exists (see `voice-support.ts`).
 */
export function ActiveVoice({ voice, mine, onDone }: { voice: VoiceNote; mine: boolean; onDone: () => void }) {
  const player = useAudioPlayer(voice.url);
  const status = useAudioPlayerStatus(player);

  // Plays as it becomes the active one, out loud even with the phone on silent.
  useEffect(() => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    player.play();
  }, [player]);

  const finished = useEffectEvent(onDone);
  useEffect(() => {
    if (status.didJustFinish) finished();
  }, [status.didJustFinish]);

  const total = status.duration > 0 ? status.duration * 1000 : voice.durationMs;
  const played = status.currentTime * 1000;
  return (
    <VoiceRow
      voice={voice}
      mine={mine}
      playing={status.playing}
      progress={total > 0 ? Math.min(1, played / total) : 0}
      time={voiceTime(Math.max(0, total - played))}
      onPress={() => (status.playing ? player.pause() : player.play())}
    />
  );
}
