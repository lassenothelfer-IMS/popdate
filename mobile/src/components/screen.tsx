import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputInstance,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, MaxContentWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Room left between a revealed field and the edge of what you can see. */
const REVEAL_MARGIN = Space.md;
/** Lets the keyboard's room settle into the layout before a field is measured. */
const REVEAL_DELAY = 60;

const RevealContext = createContext<((input: TextInputInstance | null) => void) | null>(null);
const RevealViewContext = createContext<((view: ViewInstance, animated: boolean) => void) | null>(null);

/**
 * Inside a scrolling Screen: call it with a field as it gains focus (or grows
 * while you type) and the screen scrolls it clear of the keyboard and footer.
 * Null outside one.
 */
export function useRevealField() {
  return use(RevealContext);
}

/**
 * Inside a scrolling Screen: call it with a view that just appeared, like a
 * question below the fold, and the screen scrolls it into view. Null outside one.
 */
export function useRevealView() {
  return use(RevealViewContext);
}

/** Scrolls `scroller` so `view` sits inside `viewport`, by the least it takes. */
function bringIntoView(
  viewport: ViewInstance | null,
  scroller: ScrollViewInstance | null,
  scrollY: number,
  view: ViewInstance | TextInputInstance,
  animated: boolean,
) {
  if (!viewport || !scroller) return;
  viewport.measureInWindow((_vx, viewTop, _vw, viewHeight) => {
    view.measureInWindow((_x, top, _w, height) => {
      const visibleTop = viewTop + REVEAL_MARGIN;
      const visibleBottom = viewTop + viewHeight - REVEAL_MARGIN;
      // Below the fold: bring its bottom up, where the caret of a growing bio is.
      const below = top + height - visibleBottom;
      const delta = below > 0 ? below : top < visibleTop ? top - visibleTop : 0;
      if (delta === 0) return;
      scroller.scrollTo({ y: Math.max(0, scrollY + delta), animated });
    });
  });
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
    if (!input || !input.isFocused()) return;
    bringIntoView(viewportRef.current, scrollRef.current, scrollY.current, input, true);
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

  /** A view that just appeared: scrolled to once it has laid out. */
  function revealView(view: ViewInstance, animated: boolean) {
    setTimeout(() => bringIntoView(viewportRef.current, scrollRef.current, scrollY.current, view, animated), REVEAL_DELAY);
  }

  return { viewportRef, scrollRef, onScroll, reveal, revealView };
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
  /** Pull to refresh, for a scrolling screen: the spinner shows until the promise settles. */
  onRefresh?: () => Promise<unknown>;
};

export function Screen({
  children,
  footer,
  footerStyle = 'bar',
  scroll = false,
  contentStyle,
  background,
  onRefresh,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { viewportRef, scrollRef, onScroll, reveal, revealView } = useFieldReveal(scroll);
  const [refreshing, setRefreshing] = useState(false);
  // The bottom inset belongs to whatever sits lowest: the footer, or the content.
  const bottom = Math.max(insets.bottom, Space.md);

  function refresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    const done = () => setRefreshing(false);
    onRefresh().then(done, done);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
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
            <RevealViewContext value={revealView}>
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
                  // The web has no pull gesture to answer.
                  refreshControl={
                    onRefresh && Platform.OS !== 'web' ? (
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor={theme.accent}
                        colors={[theme.accent]}
                        progressBackgroundColor={theme.sheet}
                      />
                    ) : undefined
                  }
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
            </RevealViewContext>
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
