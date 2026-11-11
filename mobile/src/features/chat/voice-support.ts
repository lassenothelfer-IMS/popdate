import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Whether this app can record and play voice messages. The audio module is
 * part of the app's own builds, but an Expo Go that doesn't carry it would
 * crash on loading it, and take the whole chat down with it. Where it is
 * missing, the chat works without voice: no mic button, and a voice message
 * shows but doesn't play.
 */
export const voiceAvailable = Platform.OS === 'web' || requireOptionalNativeModule('ExpoAudio') !== null;
