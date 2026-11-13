import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Whether Apple's own controls from `@expo/ui` (SwiftUI) can be drawn here: on
 * iOS, in a build or an Expo Go that carries the module. Everywhere else the
 * app draws its own version of the same control.
 */
export const swiftUI = Platform.OS === 'ios' && requireOptionalNativeModule('ExpoUI') !== null;
