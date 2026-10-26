import { useEffect, useEffectEvent } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Android's back button and back gesture run `onBack` instead of leaving the screen.
 * The last listener added runs first, so this goes before the router's own handler.
 * Android only: iOS has no hardware back, and the web's BackHandler logs an error.
 */
export function useHardwareBack(onBack: () => void, enabled = true) {
  const handleBack = useEffectEvent(onBack);
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [enabled]);
}
