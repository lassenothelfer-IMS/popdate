import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** The dim fades in under the sheet. Opacity only, so it stays under Reduce Motion. */
const dimIn = FadeIn.duration(Motion.state).reduceMotion(ReduceMotion.Never);
/** The sheet slides up over 520 ms on cubic-bezier(.32, .72, 0, 1). */
const sheetIn = SlideInDown.duration(520).easing(Ease.sheet).reduceMotion(ReduceMotion.System);

type SheetProps = {
  visible: boolean;
  /** The dim, the grabber area and Android's back button all call this. */
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * A bottom sheet: surface 1, 28 pt top corners, a 36 x 5 grabber at 30% of the
 * text color, and a dim behind it. Use for short choices like the report reasons.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={dimIn} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      {/* Rides up with the keyboard, so a field in the sheet stays in view. */}
      <KeyboardAvoidingView
        style={styles.anchor}
        pointerEvents="box-none"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          entering={sheetIn}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.sheet, paddingBottom: insets.bottom + Space.md }]}>
          <View style={[styles.grabber, { backgroundColor: theme.text }]} />
          {title ? (
            <ThemedText type="task" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: Gutter,
    paddingTop: Space.xs,
    gap: Space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.3,
    marginBottom: Space.xs,
  },
  title: {
    textAlign: 'center',
  },
});
