import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTabActive } from '@/components/tab-bar';
import type { ImagerySlot } from '@/constants/imagery';
import { Gutter, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** A video fades in over this long once its first frame is on screen. */
const FADE_MS = 250;
/** How much of a photo's foot melts into the page, in points. */
const FOOT = 96;

/** The slot's photo, and over it its muted loop when it has one. Fills its parent. */
function SlotMedia({ slot, position }: { slot: ImagerySlot; position?: 'top' | 'center' }) {
  const reduced = useReduceMotion();
  return (
    <>
      <Image
        source={slot.image}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={position ?? 'center'}
        transition={Motion.enter}
      />
      {slot.video && !reduced ? <SlotVideo video={slot.video} /> : null}
    </>
  );
}

/** Plays only while its tab is on screen and the app is in front; never takes the audio. */
function SlotVideo({ video }: { video: VideoSource }) {
  const player = useVideoPlayer(video, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.audioMixingMode = 'mixWithOthers';
    instance.showNowPlayingNotification = false;
    instance.staysActiveInBackground = false;
  });
  const showing = useTabActive();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const playing = showing && foreground;
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  const shown = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
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
  );
}

/**
 * A photo or loop behind a whole screen, washed with the page's color so black
 * text stays readable over it: nearly solid behind the headline at the top, at
 * its lightest in the middle (behind the balloon on Play), and fully the page
 * again well before the foot, so nothing shows through the tab bar.
 */
export function Backdrop({ slot }: { slot: ImagerySlot }) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Animated.View
      entering={FadeIn.duration(Motion.entrance)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <SlotMedia slot={slot} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.page} stopOpacity={0.94} />
            <Stop offset="0.3" stopColor={theme.page} stopOpacity={0.82} />
            <Stop offset="0.52" stopColor={theme.page} stopOpacity={0.4} />
            <Stop offset="0.74" stopColor={theme.page} stopOpacity={1} />
            <Stop offset="1" stopColor={theme.page} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A photo or loop as a block of its own, for an empty state: the full width of
 * the phone (it reaches past the page's gutters), with its foot melting into
 * the page so the heading under it belongs to it.
 */
export function SlotPhoto({ slot, style }: { slot: ImagerySlot; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View
      style={[styles.photo, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <SlotMedia slot={slot} position="top" />
      <Svg style={styles.foot} width="100%" height={FOOT}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.page} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.page} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={FOOT} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    marginHorizontal: -Gutter,
    aspectRatio: 4 / 5,
    overflow: 'hidden',
  },
  // One point lower than the photo's edge, so no line of photo shows under the fade.
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
  },
});
