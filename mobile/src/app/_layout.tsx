import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ApiProvider } from '@/api/provider';
import { ErrorScreen } from '@/components/error-screen';
import { KeyboardProvider } from '@/components/keyboard';
import { OfflineBanner } from '@/components/offline-banner';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { SessionProvider } from '@/state/session';
import { SettingsProvider } from '@/state/settings';
import { usePushRouting } from '@/utils/push-routing';

// The splash stays up until both typefaces are in, so no screen paints in a fallback font.
SplashScreen.preventAutoHideAsync();

/** A crash anywhere in the app lands here, is reported, and offers Try again. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // A crash before the fonts are in would otherwise stay behind the splash.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return <ErrorScreen error={error} retry={() => void retry()} />;
}

/** The pushed pages of Settings. Their titles stay in the page, in the brand's serif. */
const SETTINGS_PAGES = [
  'settings/index',
  'settings/language',
  'settings/region',
  'settings/blocked',
  'settings/safety-tips',
  'settings/terms',
  'settings/privacy',
];

/**
 * On iOS a pushed page gets the system's navigation bar with nothing in it but
 * Back: clear, over the page, so iOS 26 draws the button in glass. Elsewhere the
 * page draws its own back button (`PageBack`).
 */
const nativeBack =
  Platform.OS === 'ios'
    ? ({
        headerShown: true,
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: Colors.text,
      } as const)
    : {};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts([
    {
      fontFamily: Fonts.serif,
      fontDefinitions: [
        { path: InstrumentSerif_400Regular, weight: 400 },
        { path: InstrumentSerif_400Regular_Italic, weight: 400, style: 'italic' },
      ],
    },
    {
      fontFamily: Fonts.sans,
      fontDefinitions: [
        { path: HankenGrotesk_400Regular, weight: 400 },
        { path: HankenGrotesk_500Medium, weight: 500 },
        { path: HankenGrotesk_600SemiBold, weight: 600 },
        { path: HankenGrotesk_700Bold, weight: 700 },
      ],
    },
    {
      fontFamily: Fonts.plus,
      fontDefinitions: [{ path: Fraunces_400Regular_Italic, weight: 400, style: 'italic' }],
    },
  ]);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // Settings sit above the stack, so your Language applies to every screen.
  return (
    <ApiProvider>
      <SessionProvider>
        <SettingsProvider>
          <KeyboardProvider>
            <ThemedStack />
          </KeyboardProvider>
        </SettingsProvider>
      </SessionProvider>
    </ApiProvider>
  );
}

function ThemedStack() {
  // A tapped push opens its room, match or chat.
  usePushRouting();
  const palette = Colors;
  const base = DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: palette.page,
      card: palette.page,
      text: palette.text,
      border: palette.border,
      primary: palette.accentText,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="profile-setup" options={{ animation: 'fade' }} />
        {/* No swipe-back out of the queue, a running game or the match moment. */}
        <Stack.Screen name="queue" options={{ gestureEnabled: false }} />
        {/* The room and the match arrive as moments, not as pages pushed on a stack. */}
        <Stack.Screen name="room/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="match/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
        {/* Settings and its pages: the system's navigation bar on iOS, for its back button only. */}
        {SETTINGS_PAGES.map((name) => (
          <Stack.Screen key={name} name={name} options={nativeBack} />
        ))}
        {/* Taking the verification selfie is a task of its own: a sheet you finish or close. */}
        <Stack.Screen name="settings/verify" options={{ presentation: 'modal' }} />
        <Stack.Screen name="how-to-play" options={{ presentation: 'modal' }} />
        {/* Editing your profile is a task you finish or cancel: a sheet that asks before discarding. */}
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        {/* The balloon packs: a sheet over the screen you were on. On iOS the system's form
            sheet, as tall as the packs; elsewhere it draws its own dim and motion. */}
        <Stack.Screen
          name="balloons"
          options={
            Platform.OS === 'ios'
              ? {
                  presentation: 'formSheet',
                  sheetAllowedDetents: 'fitToContents',
                  sheetGrabberVisible: true,
                  sheetCornerRadius: Radius.sheet,
                  contentStyle: { backgroundColor: Colors.sheet },
                }
              : { presentation: 'transparentModal', animation: 'none', gestureEnabled: false }
          }
        />
        <Stack.Screen name="plus" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <OfflineBanner />
    </ThemeProvider>
  );
}
