import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { ErrorIcon, errorEnter } from '@/components/error-line';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
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
  accessibilityHint,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const scheme = useScheme();
  const [focused, setFocused] = useState(false);
  const errorMessage = error && hint ? hint : undefined;

  // VoiceOver ignores live regions, so say a new error once, after the key echo.
  useEffect(() => {
    if (errorMessage && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(errorMessage, { queue: true });
    }
  }, [errorMessage]);
  const edge = error ? theme.danger : focused || multiline ? theme.borderStrong : theme.outline;

  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="footnote" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          { backgroundColor: theme.field, borderColor: edge },
        ]}>
        <TextInput
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={theme.textTertiary}
          keyboardAppearance={scheme}
          selectionColor={theme.text}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
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
});
