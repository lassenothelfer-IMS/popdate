import { router } from 'expo-router';

/**
 * Back to Home from anywhere: pops every screen above it (the match, a recap or
 * chat opened from it), or replaces the screen when Home isn't on the stack,
 * like after a reload.
 */
export function goHome() {
  router.dismissTo('/home');
}
