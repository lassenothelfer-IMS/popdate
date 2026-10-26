import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useLaunchReducedMotion } from 'react-native-reanimated';

/**
 * Whether Reduce Motion is on, kept up to date while the app runs.
 * Reanimated's useReducedMotion is read once at launch, so turning the setting
 * on mid-session would change nothing. This starts from that launch value and
 * then follows the system. (Reanimated's own ReduceMotion.System builders still
 * use the launch value.)
 */
export function useReduceMotion(): boolean {
  const atLaunch = useLaunchReducedMotion();
  const live = useSyncExternalStore(subscribe, read, read);
  return live ?? atLaunch;
}

let current: boolean | null = null;
const listeners = new Set<() => void>();
let started = false;

function set(value: boolean) {
  if (value === current) return;
  current = value;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled().then(set, () => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

function subscribe(onChange: () => void) {
  start();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function read() {
  return current;
}
