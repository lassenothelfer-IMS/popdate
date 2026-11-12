import type { ComponentType, ReactNode } from 'react';
import { KeyboardAvoidingView as SystemAvoidingView, Platform, TurboModuleRegistry } from 'react-native';

/**
 * react-native-keyboard-controller moves things with the keyboard frame by frame,
 * also while you drag the keyboard down. It is native code: Expo Go and the web
 * don't have it, and importing it there throws, so it is only loaded where its
 * module exists. Everywhere else React Native's own avoiding view stands in.
 */
export const keyboardControllerAvailable =
  Platform.OS !== 'web' && TurboModuleRegistry.get('KeyboardController') != null;

type Library = typeof import('react-native-keyboard-controller');
const library: Library | null = keyboardControllerAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- only where the native module exists
    (require('react-native-keyboard-controller') as Library)
  : null;

/** Goes around the whole app once, at the root. Without the library it is just its children. */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  if (!library) return children;
  const Provider = library.KeyboardProvider;
  return <Provider>{children}</Provider>;
}

/** Same props as React Native's KeyboardAvoidingView, and follows the keyboard as it moves. */
export const KeyboardAvoidingView = (library?.KeyboardAvoidingView ??
  SystemAvoidingView) as ComponentType<React.ComponentProps<typeof SystemAvoidingView>>;

/**
 * How a scrolling screen lets the keyboard go: with the library the content follows
 * a drag on the keyboard (iOS's interactive dismissal); without it, it closes on drag.
 * The web keeps it open, since a click there starts a scroll gesture.
 */
export const keyboardDismissMode = Platform.select({
  ios: keyboardControllerAvailable ? ('interactive' as const) : ('on-drag' as const),
  android: 'on-drag' as const,
  default: 'none' as const,
});
