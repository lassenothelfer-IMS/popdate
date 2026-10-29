import { createContext, use, useEffect, useId, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputInstance,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CanvasGlow, Gutter, Lamp, MaxContentWidth, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useScheme, useTheme } from '@/hooks/use-theme';

/**
 * Behind every full screen. Velvet draws the canvas glow (the only background
 * gradient in the app) and the lamp over it, which breathes. Cream is a flat
 * canvas: no gradient, no lamp. Decorative, behind everything.
 */
export function Grain() {
  const scheme = useScheme();
  const { width, height } = useWindowDimensions();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  // The web reports a zero-size window at first; the gradients' stops would be NaN.
  if (scheme !== 'dark' || !width || !height) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient
            id={`canvas${id}`}
            cx="50%"
            cy={`${CanvasGlow.cy * 100}%`}
            rx={`${CanvasGlow.rx * 100}%`}
            ry={`${CanvasGlow.ry * 100}%`}>
            {CanvasGlow.stops.map((color, i) => (
              <Stop key={i} offset={CanvasGlow.offsets[i]} stopColor={color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#canvas${id})`} />
      </Svg>
      <BreathingLamp width={width} height={height} gradient={`lamp${id}`} />
    </View>
  );
}

/**
 * The lamp: a warm ellipse over the canvas that breathes, opacity .55 to 1 and
 * scale 1 to 1.06 over 7 s, forever. Holds still under Reduce Motion.
 */
function BreathingLamp({ width, height, gradient }: { width: number; height: number; gradient: string }) {
  const reduced = useReduceMotion();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(breath);
      breath.set(1);
      return;
    }
    breath.set(0);
    breath.set(withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, breath]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * breath.get(),
    transform: [{ scale: 1 + 0.06 * breath.get() }],
  }));
  // The overlay reaches 20% past every edge, as in the mockups, so scaling never shows its rim.
  const w = width * 1.4;
  const h = height * 1.4;
  return (
    <Animated.View style={[styles.lamp, { left: -width * 0.2, top: -height * 0.2, width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient
            id={gradient}
            cx="50%"
            cy={`${((Lamp.cy * height + height * 0.2) / h) * 100}%`}
            rx={`${((Lamp.rx * width) / w) * 100}%`}
            ry={`${((Lamp.ry * height) / h) * 100}%`}>
            <Stop offset="0" stopColor={Lamp.color} stopOpacity={Lamp.opacity} />
            <Stop offset={Lamp.fadeAt} stopColor={Lamp.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#${gradient})`} />
      </Svg>
    </Animated.View>
  );
}

/** Room left between a revealed field and the edge of what you can see. */
const REVEAL_MARGIN = Space.md;
/** Lets the keyboard's room settle into the layout before a field is measured. */
const REVEAL_DELAY = 60;

const RevealContext = createContext<((input: TextInputInstance | null) => void) | null>(null);

/**
 * Inside a scrolling Screen: call it with a field as it gains focus (or grows
 * while you type) and the screen scrolls it clear of the keyboard and footer.
 * Null outside one.
 */
export function useRevealField() {
  return use(RevealContext);
}

/**
 * Keeps the focused field in view. The keyboard avoider only shrinks the scroll
 * area, so without this a field low on the page stays hidden under the footer
 * while you type into it.
 */
function useFieldReveal(enabled: boolean) {
  const viewportRef = useRef<ViewInstance>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const target = useRef<TextInputInstance | null>(null);

  function scrollIntoView() {
    const input = target.current;
    const viewport = viewportRef.current;
    if (!input || !viewport || !input.isFocused()) return;
    viewport.measureInWindow((_vx, viewTop, _vw, viewHeight) => {
      input.measureInWindow((_x, top, _w, height) => {
        const visibleTop = viewTop + REVEAL_MARGIN;
        const visibleBottom = viewTop + viewHeight - REVEAL_MARGIN;
        // Below the fold: bring its bottom up, where the caret of a growing bio is.
        const below = top + height - visibleBottom;
        const delta = below > 0 ? below : top < visibleTop ? top - visibleTop : 0;
        if (delta === 0) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
      });
    });
  }

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      clearTimeout(timer);
      timer = setTimeout(scrollIntoView, REVEAL_DELAY);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled]);

  function reveal(input: TextInputInstance | null) {
    target.current = input;
    // On a first focus the keyboard is still coming up: keyboardDidShow measures then.
    // Moving between fields, it's already up and the layout is final.
    if (Platform.OS !== 'web' && Keyboard.isVisible()) setTimeout(scrollIntoView, REVEAL_DELAY);
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }

  return { viewportRef, scrollRef, onScroll, reveal };
}

type ScreenProps = {
  children: ReactNode;
  /** Pinned below the content, above the keyboard. */
  footer?: ReactNode;
  /**
   * `bar`: the page's fill with a hairline on top, for content that scrolls
   * under it (profile, the room). `plain`: floats on the page with no edge
   * (welcome, onboarding, the match, the popped screen).
   */
  footerStyle?: 'bar' | 'plain';
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Drawn full bleed behind the content, like the welcome screen's video. */
  background?: ReactNode;
};

export function Screen({
  children,
  footer,
  footerStyle = 'bar',
  scroll = false,
  contentStyle,
  background,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { viewportRef, scrollRef, onScroll, reveal } = useFieldReveal(scroll);
  // The bottom inset belongs to whatever sits lowest: the footer, or the content.
  const bottom = Math.max(insets.bottom, Space.md);

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Grain />
      {background}
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.fill}
          // Android draws edge to edge, so the window no longer shrinks for the keyboard either.
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          // The keyboard covers the home-indicator inset, so the footer sits 12 above it, not 34.
          keyboardVerticalOffset={footer ? -(bottom - Space.sm) : 0}>
          {scroll ? (
            <RevealContext value={reveal}>
              <View ref={viewportRef} style={styles.fill}>
                <ScrollView
                  ref={scrollRef}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  style={styles.fill}
                  contentContainerStyle={[
                    styles.content,
                    !footer && { paddingBottom: bottom + Space.lg },
                    contentStyle,
                  ]}
                  keyboardShouldPersistTaps="handled"
                  // On web a click starts a scroll gesture, so any dismiss mode would blur every field.
                  // On-drag rather than interactive: the footer can't follow an interactive drag.
                  keyboardDismissMode={Platform.select({
                    ios: 'on-drag',
                    android: 'on-drag',
                    default: 'none',
                  })}>
                  {children}
                </ScrollView>
              </View>
            </RevealContext>
          ) : (
            <View
              style={[
                styles.fill,
                styles.content,
                !footer && { paddingBottom: bottom + Space.lg },
                contentStyle,
              ]}>
              {children}
            </View>
          )}
          {footer ? (
            <View
              style={[
                styles.footer,
                { paddingBottom: bottom },
                footerStyle === 'bar' && {
                  backgroundColor: theme.page,
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  paddingTop: Space.sm,
                },
              ]}>
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  lamp: {
    position: 'absolute',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.sm,
    paddingBottom: Space.lg,
  },
  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xs,
    gap: Space.xs,
  },
});
