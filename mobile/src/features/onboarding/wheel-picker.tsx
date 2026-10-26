import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type KeyDownEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { CssEase, Fonts, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * A picker of side-by-side wheels, like the birthday's day, month and year:
 * plain snapping ScrollViews, so it needs no native module. Five 40pt rows show
 * and the one under the band in the middle is the value.
 */
const ROW = 40;
const VISIBLE_ROWS = 5;
/** Inside the card's edge: the five rows plus 8pt above and below. */
const HEIGHT = ROW * VISIBLE_ROWS + 2 * Space.xs;
/** Room above the first value and below the last, so either can reach the band. */
const EDGE = (HEIGHT - ROW) / 2;
/** On web, how long scrolling must rest before the value under the band counts. */
const WEB_SETTLE_MS = 120;

const ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

const isWeb = Platform.OS === 'web';

// Web only: CSS snapping for touch scrolling in a mobile browser, and no
// scroll chaining into the page. Native snaps with snapToInterval instead.
const webScroller = (isWeb ? { scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' } : {}) as ViewStyle;
const webSnapRow = (isWeb ? { scrollSnapAlign: 'center' } : {}) as ViewStyle;

export type WheelColumn = {
  /** What VoiceOver and TalkBack call the wheel, like "Day". */
  label: string;
  values: readonly string[];
  /** Index of the chosen value in `values`. */
  selected: number;
  /** A new value: the wheel came to rest on it, or it was tapped or stepped to. No haptic of its own. */
  onChange: (index: number) => void;
  /** Share of the card's width, like a CSS fr. */
  flex?: number;
};

type WheelPickerProps = {
  columns: readonly WheelColumn[];
  /** Draws the card's edge in pop red's text shade, for a value that isn't allowed. */
  invalid?: boolean;
};

/** A 216pt raised card with a quiet band across the middle and one wheel per column. */
export function WheelPicker({ columns, invalid = false }: WheelPickerProps) {
  const theme = useTheme();
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.field,
          borderColor: invalid ? theme.accentText : theme.outline,
          transitionProperty: 'borderColor',
          transitionDuration: Motion.state,
          transitionTimingFunction: CssEase.out,
        },
      ]}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: theme.surface }]} />
      <View style={styles.columns}>
        {columns.map((column) => (
          <Wheel key={column.label} {...column} />
        ))}
      </View>
    </Animated.View>
  );
}

/** The scrollable node behind a ScrollView on web. */
function webScrollNode(instance: unknown): HTMLElement | null {
  if (!instance) return null;
  const scroller = instance as { getScrollableNode?: () => HTMLElement | null };
  return scroller.getScrollableNode?.() ?? (instance as HTMLElement);
}

function Wheel({ label, values, selected, onChange, flex = 1 }: WheelColumn) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Starts where the wheel starts, so the fade is right before the first scroll event.
  const startOffset = useSharedValue(selected * ROW);
  const offset = useScrollOffset(scrollRef, startOffset);
  const [initialOffset] = useState(() => ({ x: 0, y: selected * ROW }));
  const reduced = useReduceMotion();
  // The value the wheel shows or is gliding to, ahead of `selected` coming back.
  const shown = useRef<number | null>(null);
  // Web: the row a run of mouse wheel ticks is heading for, and the travel left over.
  const wheelTarget = useRef<number | null>(null);
  const wheelCarry = useRef(0);
  const last = values.length - 1;

  function clamp(index: number) {
    return Math.min(Math.max(index, 0), last);
  }

  function commit(index: number) {
    shown.current = index;
    onChange(index);
  }

  /** The wheel stopped: take whichever value rests under the band. */
  function settle(y: number) {
    wheelTarget.current = null;
    const index = clamp(Math.round(y / ROW));
    if (index !== shown.current) commit(index);
  }

  /** A tap, an arrow key or a VoiceOver swipe: choose it now, then glide there. */
  function select(index: number) {
    const next = clamp(index);
    if (next === shown.current) return;
    commit(next);
    scrollRef.current?.scrollTo({ y: next * ROW, animated: !reduced });
  }

  function current() {
    return shown.current ?? selected;
  }

  // Lands on the first value without motion, then follows `selected` when it
  // changes from outside, like the day clamping to a shorter month.
  useEffect(() => {
    if (shown.current === selected) return;
    const first = shown.current === null;
    shown.current = selected;
    scrollRef.current?.scrollTo({ y: selected * ROW, animated: !first && !reduced });
  }, [selected, reduced, scrollRef]);

  const settleOnWeb = useEffectEvent((y: number) => settle(y));

  // A mouse wheel moves one row per notch, a trackpad one row per 40pt of travel.
  const wheelOnWeb = useEffectEvent((event: WheelEvent, node: HTMLElement) => {
    const delta =
      event.deltaMode === 1
        ? event.deltaY * ROW
        : event.deltaMode === 2
          ? event.deltaY * HEIGHT
          : event.deltaY;
    if (delta === 0) return;
    const from = wheelTarget.current ?? current();
    // Past either end the page scrolls on instead.
    if ((delta < 0 && from === 0) || (delta > 0 && from === last)) return;
    event.preventDefault();
    let steps: number;
    if (Math.abs(delta) >= ROW) {
      wheelCarry.current = 0;
      steps = Math.sign(delta);
    } else {
      wheelCarry.current += delta;
      steps = Math.trunc(wheelCarry.current / ROW);
      wheelCarry.current -= steps * ROW;
    }
    if (steps === 0) return;
    const to = clamp(from + steps);
    wheelTarget.current = to;
    node.scrollTo({ top: to * ROW, behavior: reduced ? 'auto' : 'smooth' });
  });

  // The web has no momentum events, so a value counts once scrolling rests.
  useEffect(() => {
    if (!isWeb) return;
    const node = webScrollNode(scrollRef.current);
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => settleOnWeb(node.scrollTop), WEB_SETTLE_MS);
    };
    const onWheel = (event: WheelEvent) => wheelOnWeb(event, node);
    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(timer);
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('wheel', onWheel);
    };
  }, [scrollRef]);

  function handleEndDrag(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, velocity } = event.nativeEvent;
    const still = Math.abs(velocity?.y ?? 0) < 0.01;
    const onRow = Math.abs(contentOffset.y - Math.round(contentOffset.y / ROW) * ROW) < 0.5;
    // Otherwise the snap glides on, and onMomentumScrollEnd takes the value.
    if (still && onRow) settle(contentOffset.y);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    settle(event.nativeEvent.contentOffset.y);
  }

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    const name = event.nativeEvent.actionName;
    const step = name === 'increment' ? 1 : name === 'decrement' ? -1 : 0;
    if (step === 0) return;
    const next = clamp(current() + step);
    // At either end nothing changes, so there is nothing to say.
    if (next === current()) return;
    // VoiceOver reads the value before React has rendered the new one, so it would
    // speak one step behind; say the new value first. A birthday error queues after it.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(values[next]);
    select(next);
  }

  // Like a slider: up and right step to the next value, down and left back.
  function handleKeyDown(event: KeyDownEvent) {
    const key = event.nativeEvent.key;
    const target =
      key === 'ArrowUp' || key === 'ArrowRight'
        ? current() + 1
        : key === 'ArrowDown' || key === 'ArrowLeft'
          ? current() - 1
          : key === 'Home'
            ? 0
            : key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    select(target);
  }

  // The web reads a slider's value from ARIA, not from accessibilityValue.
  const webValue = isWeb
    ? {
        'aria-valuetext': values[selected],
        'aria-valuenow': selected + 1,
        'aria-valuemin': 1,
        'aria-valuemax': values.length,
      }
    : {};

  return (
    <View
      accessible
      focusable={isWeb}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: values[selected] }}
      accessibilityActions={ACTIONS}
      onAccessibilityAction={handleAccessibilityAction}
      onKeyDown={handleKeyDown}
      {...webValue}
      style={{ flex }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={webScroller}
        contentContainerStyle={styles.track}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        contentOffset={isWeb ? undefined : initialOffset}
        onScrollEndDrag={isWeb ? undefined : handleEndDrag}
        onMomentumScrollEnd={isWeb ? undefined : handleMomentumEnd}>
        {values.map((value, index) => (
          <WheelRow
            key={value}
            value={value}
            index={index}
            offset={offset}
            chosen={index === selected}
            onPress={() => select(index)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

type WheelRowProps = {
  value: string;
  index: number;
  offset: SharedValue<number>;
  chosen: boolean;
  onPress: () => void;
};

/** One value. It fades from text to secondary to tertiary as it moves away from the band. */
function WheelRow({ value, index, offset, chosen, onPress }: WheelRowProps) {
  const theme = useTheme();
  const near = theme.text;
  const next = theme.textSecondary;
  const far = theme.textTertiary;
  const fade = useAnimatedStyle(() => ({
    color: interpolateColor(Math.abs(offset.value / ROW - index), [0, 1, 2], [near, next, far]),
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value}
      // The wheel itself takes keyboard focus, so Tab doesn't stop at a hundred years.
      tabIndex={-1}
      onPress={onPress}
      style={[styles.row, webSnapRow]}>
      {/* The rows are a fixed 40pt, so the text grows only a little with the text size setting. */}
      <Animated.Text
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        style={[styles.value, chosen && styles.chosen, fade]}>
        {value}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // The canvas draws 216pt inside a 1pt edge.
    height: HEIGHT + 2,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: Space.xs,
    right: Space.xs,
    top: EDGE,
    height: ROW,
    borderRadius: Radius.sm,
    borderCurve: 'continuous',
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
  },
  track: {
    paddingVertical: EDGE,
  },
  row: {
    height: ROW,
    justifyContent: 'center',
    paddingHorizontal: Space.xxs,
  },
  value: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 400,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chosen: {
    fontWeight: 500,
  },
});
