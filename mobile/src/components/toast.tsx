import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { OFFLINE_BANNER_SPACE, useOnline } from '@/components/offline-banner';
import { Ease, Fonts, Radius, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** How long a toast stays. */
const TOAST_MS = 3000;

/**
 * A short confirmation, like "Saved": a pill in the text color that slides in
 * from the top and leaves after 3 s. Render the `toast` element last in a screen.
 * While the offline pill shows, it sits just under it.
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function show(text: string) {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    setKey((k) => k + 1);
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }

  const toast = message ? <Toast key={key} message={message} /> : null;
  return { show, toast };
}

function Toast({ message }: { message: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const online = useOnline();
  const top = insets.top + Space.xs + (online ? 0 : OFFLINE_BANNER_SPACE);
  return (
    <View pointerEvents="none" style={[styles.layer, { top }]}>
      <Animated.View
        entering={reduced ? undefined : SlideInUp.duration(400).easing(Ease.rise)}
        exiting={reduced ? undefined : FadeOut.duration(200)}
        style={[styles.pill, { backgroundColor: theme.inverse }]}>
        <Icon name="check" size={14} color={theme.onInverse} />
        <Text style={[styles.text, { color: theme.onInverse }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: 40,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
  },
  text: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 600,
  },
});
