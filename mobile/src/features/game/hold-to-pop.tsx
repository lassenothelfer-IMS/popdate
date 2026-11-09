import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Balloon } from '@/components/balloon';
import { MinTouch } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** How long you hold before the pop goes out. */
const HOLD_MS = 1000;
/** Letting go early drains the fill. */
const DRAIN_MS = 300;
const HEIGHT = 52;
/** The Pop action's own coral, as on the coral Button. */
const CORAL = '#F0695C';
const CORAL_FINISH = 'inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 28px -10px rgba(240,105,92,0.55)';
/** The hold fills the capsule from the left in a lighter coral. */
const FILL = 'rgba(255,255,255,0.28)';

type HoldToPopButtonProps = {
  /** The balloon's owner, for "Pop Sara's balloon". */
  name: string;
  /** The small balloon in the label, in their seat's shadow color. */
  balloonColor: string;
  /** Held to full: the pop goes out. */
  onPop: () => void;
};

/**
 * The chooser's pop, right on the coral button: hold it and a lighter coral fills
 * the capsule over 1 s. Let go before it is full and it drains, nothing happens.
 * At full the pop goes out and the burst plays in the room. VoiceOver and TalkBack
 * pop with one activate action, a double-tap.
 */
export function HoldToPopButton({ name, balloonColor, onPop }: HoldToPopButtonProps) {
  const t = useT();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const title = t('game.popBalloon', { name });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pop() {
    if (done.current) return;
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    onPop();
  }

  function pressIn() {
    if (done.current) return;
    haptics.selection();
    cancelAnimation(progress);
    const rest = HOLD_MS * (1 - progress.get());
    progress.set(withTiming(1, { duration: rest, easing: Easing.linear }));
    timer.current = setTimeout(pop, rest);
  }

  function pressOut() {
    if (done.current) return;
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: DRAIN_MS, easing: Easing.out(Easing.ease) }));
  }

  function accessibilityAction(event: AccessibilityActionEvent) {
    if (event.nativeEvent.actionName === 'activate') pop();
  }

  // The fill is the hold's progress, so it shows under Reduce Motion too; only the grow goes.
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  const grow = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 + 0.02 * Math.min(1, progress.get() * 8) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      // Screen readers pop with a double-tap, so the spoken hint says that; the hold is for touch.
      accessibilityHint={t('game.popActionHint', { name })}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={accessibilityAction}
      onPressIn={pressIn}
      onPressOut={pressOut}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={styles.target}>
      <Animated.View style={[styles.capsule, { boxShadow: CORAL_FINISH }, grow]}>
        <View pointerEvents="none" style={styles.clip}>
          <Animated.View style={[styles.fill, fill]} />
        </View>
        <View style={styles.content}>
          <Balloon color={balloonColor} size={14} shine={false} />
          <Text numberOfLines={1} style={styles.label}>
            {title}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minHeight: MinTouch,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  capsule: {
    minHeight: HEIGHT,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORAL,
  },
  // Keeps the fill inside the capsule's round ends, while the shadow stays outside.
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FILL,
    transformOrigin: 'left',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // The Button's label: SF Pro 17 semibold, white on coral.
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
    letterSpacing: -0.2,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});
