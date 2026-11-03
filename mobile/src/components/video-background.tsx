import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useCallback, useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';

type VideoBackgroundProps = {
  video: VideoSource;
  /** The video's exact first frame: shown until the video has a frame of its own. */
  poster: number;
  /** The scrims' color: the screen's canvas. */
  tint: string;
};

/** The video fades in over this long once its first frame is on screen. */
const FADE_MS = 250;

/**
 * A full-bleed, muted, looping video behind a screen, over its poster so there
 * is never a black frame. It never interrupts the music or podcast you're
 * playing, pauses in the background or when the screen loses focus, and under
 * Reduce Motion shows only the poster. Scrims at the top and bottom keep the
 * text and buttons over it readable.
 */
export function VideoBackground({ video, poster, tint }: VideoBackgroundProps) {
  const reduced = useReduceMotion();
  const player = useVideoPlayer(video, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.audioMixingMode = 'mixWithOthers';
    instance.showNowPlayingNotification = false;
    instance.staysActiveInBackground = false;
  });

  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  const playing = focused && foreground && !reduced;
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  const shown = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image source={poster} style={StyleSheet.absoluteFill} contentFit="cover" />
      {reduced ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            onFirstFrameRender={() => shown.set(withTiming(1, { duration: FADE_MS }))}
          />
        </Animated.View>
      )}
      <Scrims tint={tint} />
    </View>
  );
}

/**
 * Top: the tint at 55% fading out by 36%, behind the logo. Bottom: clear down to
 * 48%, then the tint up to 94% at the foot, behind the copy and buttons.
 */
function Scrims({ tint }: { tint: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={`top${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity={0.55} />
          <Stop offset="0.36" stopColor={tint} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`bottom${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.48" stopColor={tint} stopOpacity={0} />
          <Stop offset="1" stopColor={tint} stopOpacity={0.94} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#top${id})`} />
      <Rect width="100%" height="100%" fill={`url(#bottom${id})`} />
    </Svg>
  );
}
