import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, MaxContentWidth, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

const GRAIN = require('@/assets/images/grain.png');

/** Film grain over the paper, light mode only. Decorative, behind everything. */
export function Grain() {
  const scheme = useScheme();
  if (scheme === 'dark') return null;
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.grain}
    />
  );
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
};

export function Screen({
  children,
  footer,
  footerStyle = 'bar',
  scroll = false,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The bottom inset belongs to whatever sits lowest: the footer, or the content.
  const bottom = Math.max(insets.bottom, Space.md);

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <Grain />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.fill}
          // Android draws edge to edge, so the window no longer shrinks for the keyboard either.
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          // The keyboard covers the home-indicator inset, so the footer sits 12 above it, not 34.
          keyboardVerticalOffset={footer ? -(bottom - Space.sm) : 0}>
          {scroll ? (
            <ScrollView
              style={styles.fill}
              contentContainerStyle={[
                styles.content,
                !footer && { paddingBottom: bottom + Space.lg },
                contentStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              // On web a click starts a scroll gesture, so any dismiss mode would blur every field.
              // On-drag rather than interactive: the footer can't follow an interactive drag.
              keyboardDismissMode={Platform.select({
                ios: 'on-drag',
                android: 'on-drag',
                default: 'none',
              })}>
              {children}
            </ScrollView>
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
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.03,
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
