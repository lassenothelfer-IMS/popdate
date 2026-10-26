import { Platform, useWindowDimensions } from 'react-native';

/**
 * How much the user has enlarged text (1 = default). React Native Web reports
 * the screen's pixel density here instead, so the web always counts as 1.
 */
export function useTextScale() {
  const { fontScale } = useWindowDimensions();
  return Platform.OS === 'web' ? 1 : fontScale;
}
