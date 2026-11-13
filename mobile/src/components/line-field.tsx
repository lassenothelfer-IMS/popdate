import { useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputInstance, type TextInputProps } from 'react-native';

import { textStyleOf } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LineFieldProps = TextInputProps & {
  ref?: Ref<TextInputInstance>;
  /** The answer is wrong as typed: the line turns the danger color. */
  error?: boolean;
};

/**
 * An answer typed straight onto the page, Hinge style: large serif text on a
 * single line, no box around it. The line darkens while you type. For the one
 * question a screen asks, like your name.
 */
export function LineField({ ref, error = false, style, onFocus, onBlur, ...rest }: LineFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textSecondary}
      selectionColor={theme.text}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        textStyleOf('display'),
        styles.field,
        {
          color: theme.text,
          borderBottomColor: error ? theme.danger : focused ? theme.text : theme.borderStrong,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    paddingVertical: Space.xs,
    borderBottomWidth: 1.5,
    // The web draws its own focus ring around inputs: the line is the focus here.
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as object, default: {} }),
  },
});
