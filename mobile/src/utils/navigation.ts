import { router } from 'expo-router';

/**
 * Queue, room and match replace each other on the stack, so home is right
 * below them. After a reload there is nothing below, so replace instead.
 */
export function goHome() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/home');
  }
}
