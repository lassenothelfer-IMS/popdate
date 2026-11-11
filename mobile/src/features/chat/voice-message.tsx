import { VoiceRow } from '@/features/chat/voice-row';
import { voiceAvailable } from '@/features/chat/voice-support';
import { voiceTime, type VoiceNote } from '@/shared/chat';

/** The player, loaded only where the phone's audio module exists. */
const player = voiceAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the audio module exists, or the chat would crash without it
    (require('@/features/chat/voice-player') as typeof import('@/features/chat/voice-player'))
  : null;

type VoiceMessageProps = {
  voice: VoiceNote;
  /** In your own bubble, on the dark fill. */
  mine: boolean;
  /** This is the one playing (or paused part-way). Only one voice message is at a time. */
  active: boolean;
  /** Play was pressed. Left out for a message still on its way, which can't play yet. */
  onPlay?: () => void;
  /** It played to the end. */
  onDone: () => void;
};

/**
 * A voice message in its bubble: play or pause, the waveform filling as it
 * plays, and how long it is. The player only exists while this one is active.
 */
export function VoiceMessage({ voice, mine, active, onPlay, onDone }: VoiceMessageProps) {
  if (active && player) return <player.ActiveVoice voice={voice} mine={mine} onDone={onDone} />;
  return (
    <VoiceRow
      voice={voice}
      mine={mine}
      playing={false}
      progress={0}
      time={voiceTime(voice.durationMs)}
      // Without the audio module it shows, but there is nothing to play it with.
      onPress={player ? onPlay : undefined}
    />
  );
}
