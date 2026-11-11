import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { MAX_VOICE_MS, MIN_VOICE_MS, voiceTime, waveformFrom } from '@/shared/chat';
import { haptics } from '@/utils/haptics';

/** Speech doesn't need stereo or a music bitrate: a minute stays under half a megabyte. */
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};
/** How often the recorder is asked how loud it is and how long it has run. */
const TICK_MS = 100;
/** The quietest level the meter still shows, in dB below full scale. */
const FLOOR_DB = 50;
/** The same pill as the message field. */
const BAR_HEIGHT = 48;
const BUTTON = 36;
/** The bars showing right now: the last few seconds, newest on the right. */
const LIVE_BARS = 26;

export type Recording = { uri: string; durationMs: number; waveform: number[] };

/** The meter's dB as 0 to 1. Without a meter (the web), a gentle wave so the bar still moves. */
function levelOf(metering: number | undefined, tick: number) {
  if (metering === undefined) return 0.3 + 0.2 * Math.abs(Math.sin(tick * 0.6));
  return Math.min(1, Math.max(0, (metering + FLOOR_DB) / FLOOR_DB));
}

type VoiceRecorderProps = {
  onSend: (recording: Recording) => void;
  /** Recording ended without a message: cancelled, too short, or it failed (then with why). */
  onClose: (error?: string) => void;
};

/**
 * Recording a voice message, in the message field's place: it starts as it
 * mounts, shows the time and how loud you are, and ends with Send or with the
 * bin. At a minute it stops by itself and waits for one of the two.
 */
export function VoiceRecorder({ onSend, onClose }: VoiceRecorderProps) {
  const theme = useTheme();
  const t = useT();
  const recorder = useAudioRecorder(OPTIONS);
  /** Every tick's loudness, for the message's waveform. */
  const levels = useRef<number[]>([]);
  /** The last few of them, for the bars on screen. */
  const [live, setLive] = useState<{ tick: number; level: number }[]>([]);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /** Set once the recorder has stopped at the limit; the recording waits to be sent. */
  const [full, setFull] = useState(false);
  /** Send or delete was pressed: nothing else may end the recording twice. */
  const ending = useRef(false);

  const begin = useEffectEvent(async (isCurrent: () => boolean) => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!isCurrent()) return;
      if (!permission.granted) {
        onClose(t('chat.micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!isCurrent()) return;
      recorder.record();
      haptics.light();
      setStarted(true);
    } catch {
      if (isCurrent()) onClose(t('chat.recordFailed'));
    }
  });
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => void begin(() => current), 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, []);

  // While it records: the time, the loudness, and the stop at the limit.
  useEffect(() => {
    if (!started || full) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      const tick = levels.current.length;
      const level = levelOf(status.metering, tick);
      levels.current.push(level);
      setLive((shown) => [...shown, { tick, level }].slice(-LIVE_BARS));
      setElapsed(status.durationMillis);
      if (status.durationMillis >= MAX_VOICE_MS) {
        setFull(true);
        haptics.light();
        void recorder.stop().catch(() => {});
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [started, full, recorder]);

  /** Stops the recorder and hands the phone's audio back to playback. */
  async function finish() {
    if (recorder.getStatus().isRecording) await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }

  async function send() {
    if (ending.current || !started) return;
    ending.current = true;
    try {
      await finish();
      const uri = recorder.uri;
      const durationMs = Math.min(elapsed, MAX_VOICE_MS);
      // A tap by mistake isn't a message.
      if (!uri || durationMs < MIN_VOICE_MS) onClose();
      else onSend({ uri, durationMs, waveform: waveformFrom(levels.current) });
    } catch {
      onClose(t('chat.recordFailed'));
    }
  }

  async function cancel() {
    if (ending.current) return;
    ending.current = true;
    await finish().catch(() => {});
    onClose();
  }

  return (
    <View
      accessible={false}
      style={[styles.bar, { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.borderStrong}` }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('chat.cancelRecording')}
        onPress={() => void cancel()}
        hitSlop={Space.xxs}
        style={[styles.button, { backgroundColor: theme.surface }]}>
        <Icon name="close" size={13} color={theme.text} />
      </PressableScale>
      <View
        accessible
        accessibilityRole="timer"
        accessibilityLabel={`${t('chat.recording')}, ${voiceTime(elapsed)}`}
        style={styles.status}>
        <RecordingDot color={theme.danger} still={full || !started} />
        <ThemedText type="timer" style={styles.time}>
          {voiceTime(elapsed)}
        </ThemedText>
        <View style={styles.levels}>
          {live.map((bar) => (
            <View
              key={bar.tick}
              style={[styles.level, { height: 4 + 20 * bar.level, backgroundColor: theme.textTertiary }]}
            />
          ))}
        </View>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('chat.sendVoice')}
        accessibilityState={{ disabled: !started }}
        disabled={!started}
        onPress={() => void send()}
        hitSlop={Space.xxs}
        style={[styles.button, { backgroundColor: theme.inverse }]}>
        <Icon name="send" size={16} color={theme.onInverse} />
      </PressableScale>
    </View>
  );
}

/** The red dot that says it is recording. It breathes while it does. */
function RecordingDot({ color, still }: { color: string; still: boolean }) {
  const reduced = useReduceMotion();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (still || reduced) {
      cancelAnimation(breath);
      breath.set(1);
      return;
    }
    breath.set(withRepeat(withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(breath);
  }, [still, reduced, breath]);
  const style = useAnimatedStyle(() => ({ opacity: breath.get() }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderCurve: 'continuous',
    paddingHorizontal: 6,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    overflow: 'hidden',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  time: {
    fontSize: 15,
    lineHeight: 20,
    minWidth: 34,
  },
  levels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    height: 26,
    overflow: 'hidden',
  },
  level: {
    width: 3,
    borderRadius: 1.5,
  },
});
