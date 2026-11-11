import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useEffectEvent } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { voiceTime, type VoiceNote } from '@/shared/chat';

const BUTTON = 34;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BARS_HEIGHT = 26;

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
  if (active) return <ActiveVoice voice={voice} mine={mine} onDone={onDone} />;
  return (
    <VoiceRow
      voice={voice}
      mine={mine}
      playing={false}
      progress={0}
      time={voiceTime(voice.durationMs)}
      onPress={onPlay}
    />
  );
}

function ActiveVoice({ voice, mine, onDone }: { voice: VoiceNote; mine: boolean; onDone: () => void }) {
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

type VoiceRowProps = {
  voice: VoiceNote;
  mine: boolean;
  playing: boolean;
  /** How much has played, 0 to 1. */
  progress: number;
  time: string;
  onPress?: () => void;
};

function VoiceRow({ voice, mine, playing, progress, time, onPress }: VoiceRowProps) {
  const theme = useTheme();
  const t = useT();
  // On your dark bubble the button is light; on theirs it is dark.
  const ink = mine ? theme.onInverse : theme.text;
  const playedBars = Math.round(progress * voice.waveform.length);
  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={playing ? t('chat.pauseVoice') : t('chat.playVoice')}
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        hitSlop={Space.xs}
        style={[styles.button, { backgroundColor: ink }]}>
        <Icon name={playing ? 'pause' : 'play'} size={14} color={mine ? theme.inverse : theme.onInverse} />
      </PressableScale>
      <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {voice.waveform.map((level, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(3, BARS_HEIGHT * level),
                backgroundColor: ink,
                // What has played is solid; a message not yet started is solid too, so it reads at rest.
                opacity: progress === 0 || i < playedBars ? 0.95 : 0.35,
              },
            ]}
          />
        ))}
      </View>
      <ThemedText type="timer" style={[styles.time, { color: ink }]}>
        {time}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
    height: BARS_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  time: {
    minWidth: 30,
    opacity: 0.8,
  },
});
