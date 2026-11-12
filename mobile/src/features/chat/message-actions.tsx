import { GlassView } from 'expo-glass-effect';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { photoGlass } from '@/components/photo-disc';
import { ThemedText } from '@/components/themed-text';
import { Ease, Space } from '@/constants/theme';
import type { BubbleAnchor } from '@/features/chat/message-list';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { REACTIONS } from '@/shared/chat';
import { webSafeKeyframe } from '@/utils/web-motion';

/** The bar's height, and the gap it keeps from the bubble it belongs to. */
const BAR_HEIGHT = 48;
const BAR_GAP = 8;

const barIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.92 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.rise },
  }).duration(240),
);

type MessageActionsProps = {
  /** Where the pressed bubble is on the screen. Null while nothing is pressed. */
  anchor: BubbleAnchor | null;
  /** The bubble is yours, so the bar sits on the right. */
  mine: boolean;
  /** Your reaction on this message, if you gave one: tapping it again takes it back. */
  current: string | null;
  onReact: (emoji: string | null) => void;
  onReply: () => void;
  onClose: () => void;
};

/**
 * What a long press on a message opens: the six reactions and Reply, in a bar
 * over the bubble (under it when there is no room above). A tap anywhere else
 * closes it.
 */
export function MessageActions({ anchor, mine, current, onReact, onReply, onClose }: MessageActionsProps) {
  const theme = useTheme();
  const t = useT();
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!anchor) return null;

  const above = anchor.y - BAR_HEIGHT - BAR_GAP;
  const below = anchor.y + anchor.height + BAR_GAP;
  const top = above >= insets.top + Space.xs ? above : Math.min(below, height - insets.bottom - BAR_HEIGHT - Space.xs);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, styles.backdrop]}
      />
      <View pointerEvents="box-none" style={[styles.row, { top }, mine ? styles.right : styles.left]}>
        <Animated.View
          entering={reduced ? undefined : barIn}
          accessibilityViewIsModal
          style={[
            styles.bar,
            photoGlass
              ? null
              : { backgroundColor: theme.page, boxShadow: `0 8px 28px -8px ${theme.scrim}, inset 0 0 0 1px ${theme.border}` },
          ]}>
          {/* On iOS 26 the bar is Liquid Glass, like the system's own reaction bar. */}
          {photoGlass ? (
            <GlassView
              glassEffectStyle="regular"
              colorScheme="light"
              tintColor="rgba(255, 253, 254, 0.6)"
              style={[StyleSheet.absoluteFill, styles.barShape]}
            />
          ) : null}
          {REACTIONS.map((emoji) => {
            const selected = emoji === current;
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={t('chat.reactWith', { emoji })}
                accessibilityState={{ selected }}
                onPress={() => onReact(selected ? null : emoji)}
                style={({ pressed }) => [
                  styles.emojiButton,
                  // Your reaction sits on the brand's wash, not on a grey disc.
                  selected && { backgroundColor: theme.brandWash },
                  pressed && styles.pressed,
                ]}>
                <Text allowFontScaling={false} style={styles.emoji}>
                  {emoji}
                </Text>
              </Pressable>
            );
          })}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.reply')}
            onPress={onReply}
            style={({ pressed }) => [styles.replyButton, pressed && styles.pressed]}>
            <ThemedText type="headline">{t('chat.reply')}</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Lighter than a sheet's dim: the chat stays readable under it.
  backdrop: {
    opacity: 0.35,
  },
  row: {
    position: 'absolute',
    left: Space.sm,
    right: Space.sm,
    flexDirection: 'row',
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    paddingHorizontal: 6,
    borderRadius: BAR_HEIGHT / 2,
    borderCurve: 'continuous',
  },
  barShape: {
    borderRadius: BAR_HEIGHT / 2,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 6,
  },
  replyButton: {
    height: 40,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
});
