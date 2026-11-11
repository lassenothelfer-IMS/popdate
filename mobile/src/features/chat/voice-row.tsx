import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import type { VoiceNote } from '@/shared/chat';

const BUTTON = 34;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BARS_HEIGHT = 26;

type VoiceRowProps = {
  voice: VoiceNote;
  mine: boolean;
  playing: boolean;
  /** How much has played, 0 to 1. */
  progress: number;
  time: string;
  onPress?: () => void;
};

/** A voice message as it is drawn: the button, the waveform and the time. It plays nothing itself. */
export function VoiceRow({ voice, mine, playing, progress, time, onPress }: VoiceRowProps) {
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
