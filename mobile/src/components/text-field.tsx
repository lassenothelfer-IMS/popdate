import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  AccessibilityInfo,
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ErrorIcon, errorEnter } from '@/components/error-line';
import { useRevealField } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type TextFieldProps = TextInputProps & {
  ref?: Ref<TextInputInstance>;
  label?: string;
  /** Short help under the field, or the error message when `error` is set. */
  hint?: string;
  error?: boolean;
  /** A unit inside the field's right edge, like "cm". */
  suffix?: string;
  /** Right-aligned under the field, like "241 characters left". */
  counter?: string;
};

/** A raised field with a hairline edge: darker while focused, pop red with an icon on error. */
export function TextField({
  label,
  hint,
  error = false,
  suffix,
  counter,
  style,
  multiline,
  onFocus,
  onBlur,
  onContentSizeChange,
  accessibilityHint,
  ref,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInputInstance>(null);
  // The caller's ref still reaches the input, to move focus from field to field.
  useImperativeHandle(ref, () => inputRef.current as TextInputInstance);
  // In a scrolling screen, a focused field scrolls clear of the keyboard and footer.
  const reveal = useRevealField();
  // iOS number pads have no return key: a Done bar above them closes the keyboard.
  const padId = `pad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const numberPad =
    Platform.OS === 'ios' && (rest.keyboardType === 'number-pad' || rest.keyboardType === 'numeric');
  const errorMessage = error && hint ? hint : undefined;

  // VoiceOver ignores live regions, so say a new error once, after the key echo.
  useEffect(() => {
    if (errorMessage && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(errorMessage, { queue: true });
    }
  }, [errorMessage]);
  const edge = error ? theme.danger : theme.borderStrong;
  // Focused: a 2 pt ring in the text color, drawn inside so the text never moves.
  const ring = focused && !error ? { boxShadow: `inset 0 0 0 2px ${theme.text}` } : null;

  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="kicker">
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          { backgroundColor: theme.field, borderColor: edge },
          ring,
        ]}>
        <TextInput
          ref={inputRef}
          inputAccessoryViewID={numberPad ? padId : undefined}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={theme.textFaint}
          keyboardAppearance="light"
          selectionColor={theme.text}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            reveal?.(inputRef.current);
            onFocus?.(event);
          }}
          onContentSizeChange={(event) => {
            // A bio grows a line at a time: keep its newest line above the keyboard.
            if (multiline && focused) reveal?.(inputRef.current);
            onContentSizeChange?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            // The field's own edge shows focus; drop the browser's outline around the text area.
            Platform.OS === 'web' && styles.noOutline,
            { color: theme.text },
            style,
          ]}
          {...rest}
          // The error rides on the field, so focusing it reads the problem too.
          accessibilityHint={errorMessage ?? accessibilityHint}
        />
        {suffix ? (
          <ThemedText type="body" themeColor="textSecondary" accessibilityElementsHidden>
            {suffix}
          </ThemedText>
        ) : null}
      </View>
      {hint && error ? (
        // Keyed, so the error fades in once as it appears, like every other error.
        <Animated.View
          key="error"
          entering={errorEnter}
          accessibilityLiveRegion="polite"
          style={styles.hint}>
          <ErrorIcon />
          <ThemedText type="footnote" themeColor="danger" style={styles.hintText}>
            {hint}
          </ThemedText>
        </Animated.View>
      ) : hint ? (
        <View key="hint" style={styles.hint}>
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.hintText}>
            {hint}
          </ThemedText>
        </View>
      ) : null}
      {counter ? (
        <ThemedText type="footnote" themeColor="textTertiary" style={styles.counter}>
          {counter}
        </ThemedText>
      ) : null}
      {numberPad ? (
        <InputAccessoryView nativeID={padId}>
          <View style={[styles.padBar, { backgroundColor: theme.sheet, borderTopColor: theme.border }]}>
            <Button
              title={t('common.done')}
              variant="plain"
              fullWidth={false}
              onPress={() => Keyboard.dismiss()}
            />
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: 52,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: Space.md,
  },
  multiline: {
    alignItems: 'flex-start',
    minHeight: 96,
  },
  input: {
    flex: 1,
    // Shrinks to leave room for a suffix; a web input otherwise keeps its own minimum width.
    minWidth: 0,
    alignSelf: 'stretch',
    paddingVertical: Space.sm,
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
  },
  multilineInput: {
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  noOutline: {
    outlineWidth: 0,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  hintText: {
    flexShrink: 1,
  },
  counter: {
    textAlign: 'right',
  },
  padBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
  },
});
