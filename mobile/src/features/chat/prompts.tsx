import { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

export type Choice = { label: string; destructive?: boolean };

type Ask = { title: string; message?: string; choices: Choice[] };
type Pending = Ask & { resolve: (index: number | null) => void };

/** Android's Alert holds at most three buttons, Cancel included. */
const ANDROID_ALERT_CHOICES = 2;

/**
 * The sheet rises from the bottom edge. A built-in, so the web plays it as it is.
 * Under Reduce Motion only the Modal's fade plays.
 */
const sheetIn = SlideInDown.duration(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.System);

/**
 * Asks for one of a few choices and resolves with its index, or null for Cancel.
 * iOS shows the native action sheet, Android an Alert while the choices fit in one,
 * and everywhere else (the web, a longer list on Android) our own bottom sheet.
 * Render `sheet` anywhere in the screen.
 */
export function useChoice() {
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);

  function choose({ title, message, choices }: Ask): Promise<number | null> {
    return new Promise((resolve) => {
      const cancel = t('common.cancel');
      if (Platform.OS === 'ios') {
        const cancelButtonIndex = choices.length;
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title,
            message,
            options: [...choices.map((choice) => choice.label), cancel],
            cancelButtonIndex,
            destructiveButtonIndex: choices.flatMap((choice, index) =>
              choice.destructive ? [index] : [],
            ),
          },
          (index) => {
            if (index === cancelButtonIndex) {
              resolve(null);
            } else {
              haptics.selection();
              resolve(index);
            }
          },
        );
        return;
      }
      if (Platform.OS === 'android' && choices.length <= ANDROID_ALERT_CHOICES) {
        const settle = once(resolve);
        Alert.alert(
          title,
          message,
          [
            { text: cancel, style: 'cancel', onPress: () => settle(null) },
            ...choices.map((choice, index) => ({
              text: choice.label,
              style: choice.destructive ? ('destructive' as const) : ('default' as const),
              onPress: () => {
                haptics.selection();
                settle(index);
              },
            })),
          ],
          { cancelable: true, onDismiss: () => settle(null) },
        );
        return;
      }
      setPending({ title, message, choices, resolve });
    });
  }

  function finish(index: number | null) {
    pending?.resolve(index);
    setPending(null);
  }

  const sheet = pending ? (
    <ChoiceSheet
      title={pending.title}
      message={pending.message}
      choices={pending.choices}
      cancelLabel={t('common.cancel')}
      onDone={finish}
    />
  ) : null;

  return { choose, sheet };
}

/**
 * Confirms a serious step, like blocking someone: the native alert with a
 * destructive button, or the browser's own confirm on the web.
 */
export function confirmStep({
  title,
  message,
  confirmLabel,
  cancelLabel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    const settle = once(resolve);
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => settle(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

/** A short acknowledgement, like "Thanks, we'll look into it." */
export function acknowledge(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Resolves a promise only once, whichever of an alert's callbacks comes first. */
function once<T>(resolve: (value: T) => void) {
  let settled = false;
  return (value: T) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };
}

type ChoiceSheetProps = Ask & {
  cancelLabel: string;
  onDone: (index: number | null) => void;
};

/** A bottom sheet of 56pt choices with hairlines between them, and Cancel under them. */
function ChoiceSheet({ title, message, choices, cancelLabel, onDone }: ChoiceSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  function pick(index: number) {
    haptics.selection();
    onDone(index);
  }

  return (
    // The back button on Android and Escape on the web both cancel.
    <Modal transparent visible animationType="fade" onRequestClose={() => onDone(null)}>
      <View style={styles.root}>
        {/* Tapping beside the sheet cancels. Hidden from screen readers, which get Cancel. */}
        <Pressable
          aria-hidden
          focusable={false}
          onPress={() => onDone(null)}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
        />
        <Animated.View entering={sheetIn} style={styles.slot}>
          <View
            role="dialog"
            aria-modal
            aria-label={title}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.sheet,
                borderTopColor: theme.outline,
                paddingBottom: Math.max(insets.bottom, Space.md),
              },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.surfacePressed }]} />
            <ThemedText type="task" accessibilityRole="header" style={[styles.center, styles.title]}>
              {title}
            </ThemedText>
            {message ? (
              <ThemedText
                type="callout"
                themeColor="textSecondary"
                style={[styles.center, styles.message]}>
                {message}
              </ThemedText>
            ) : null}
            <View style={[styles.list, { borderColor: theme.border }]}>
              {choices.map((choice, index) => (
                <PressableHighlight
                  key={choice.label}
                  accessibilityRole="button"
                  accessibilityLabel={choice.label}
                  onPress={() => pick(index)}
                  background="transparent"
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopColor: theme.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <ThemedText type="row" themeColor={choice.destructive ? 'danger' : 'text'}>
                    {choice.label}
                  </ThemedText>
                </PressableHighlight>
              ))}
            </View>
            <Button title={cancelLabel} variant="ghost" onPress={() => onDone(null)} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Full width on a phone; on a wide window, as wide as the screens it covers.
  slot: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: Gutter,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  center: {
    textAlign: 'center',
  },
  title: {
    marginTop: 18,
  },
  message: {
    marginTop: Space.xxs,
  },
  list: {
    marginTop: Space.md,
    marginBottom: Space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: Space.xs,
  },
});
