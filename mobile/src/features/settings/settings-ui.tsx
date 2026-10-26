import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import { MinTouch, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

const ROW_HEIGHT = 56;

/**
 * Settings itself. The generated route types list it only as `/settings/index`,
 * so it goes through `string` once instead of failing the build.
 */
export const SETTINGS_PAGE = '/settings' as string as Href;

/** Back to the screen below, or Home after a reload left nothing below. */
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/** The native Alert on iOS and Android; the browser's own confirm on web, where Alert does nothing. */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** A plain notice with one OK, on every platform. */
export function showNotice(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** A titled group of hairline rows. */
export function SettingsSection({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  /** Notes and errors under the rows. */
  footer?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="headline" accessibilityRole="header">
        {title}
      </ThemedText>
      <View style={styles.rows}>{children}</View>
      {footer ? <View style={styles.sectionFooter}>{footer}</View> : null}
    </View>
  );
}

type NavRowProps = {
  label: string;
  /** The current value, read after the label. */
  value?: string;
  /** Tints the value, like a verified status. */
  valueColor?: 'textSecondary' | 'success' | 'danger';
  onPress: () => void;
  accessibilityHint?: string;
  /** A page opens: draw the chevron. */
  chevron?: boolean;
};

/** Label on the left, its value and a chevron on the right. */
export function NavRow({
  label,
  value,
  valueColor = 'textSecondary',
  onPress,
  accessibilityHint,
  chevron = true,
}: NavRowProps) {
  const theme = useTheme();
  return (
    <PressableHighlight
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      background="transparent"
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <ThemedText type="row" style={styles.label}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText type="callout" themeColor={valueColor} style={styles.value} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {chevron ? (
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={14} color={theme.textTertiary} />
        </View>
      ) : null}
    </PressableHighlight>
  );
}

/** A row that only shows something, like the app version. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <ThemedText type="row" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

type SwitchRowProps = {
  label: string;
  /** One line under the label, also read as the hint. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** Label (and a line under it) on the left, a switch on the right. Tapping the label flips it too. */
export function SwitchRow({ label, description, value, onValueChange, disabled }: SwitchRowProps) {
  const theme = useTheme();
  const scheme = useScheme();
  function change(next: boolean) {
    haptics.selection();
    onValueChange(next);
  }
  return (
    <Pressable
      // The switch is the one element VoiceOver stops on; the row is just a bigger target.
      accessible={false}
      disabled={disabled}
      onPress={() => change(!value)}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <View
        style={styles.label}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <ThemedText type="row" themeColor={disabled ? 'textTertiary' : 'text'}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={description}
        value={value}
        disabled={disabled}
        onValueChange={change}
        trackColor={{ false: theme.surfacePressed, true: theme.inverse }}
        ios_backgroundColor={theme.surfacePressed}
        // The thumb keeps its contrast on both tracks in both modes.
        thumbColor={value ? theme.onInverse : scheme === 'dark' ? theme.textSecondary : theme.field}
      />
    </Pressable>
  );
}

type ChoiceRowProps<T extends string> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A short single choice inline: the label, then its options as chips. */
export function ChoiceRow<T extends string>({ label, options, value, onChange }: ChoiceRowProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.choice, { borderBottomColor: theme.border }]}>
      <ThemedText type="row">{label}</ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => {
              if (option.value !== value) onChange(option.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Space.xl,
  },
  rows: {
    marginTop: Space.xxs,
  },
  sectionFooter: {
    marginTop: Space.sm,
    gap: Space.xs,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
  value: {
    flexShrink: 1,
    maxWidth: '55%',
    textAlign: 'right',
  },
  // The chevron's 18pt slot, like the match rows on Home.
  chevron: {
    width: 18,
    alignItems: 'center',
  },
  choice: {
    paddingVertical: Space.sm,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
    minHeight: MinTouch - Space.xs,
  },
});
