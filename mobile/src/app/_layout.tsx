import { Gloock_400Regular } from '@expo-google-fonts/gloock';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { useScheme } from '@/hooks/use-theme';
import { SessionProvider } from '@/state/session';

// The splash stays up until both typefaces are in, so no screen paints in a fallback font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();
  const palette = Colors[scheme];
  const [fontsLoaded, fontError] = useFonts([
    { fontFamily: Fonts.serif, fontDefinitions: [{ path: Gloock_400Regular, weight: 400 }] },
    {
      fontFamily: Fonts.sans,
      fontDefinitions: [
        { path: HankenGrotesk_400Regular, weight: 400 },
        { path: HankenGrotesk_500Medium, weight: 500 },
        { path: HankenGrotesk_600SemiBold, weight: 600 },
        { path: HankenGrotesk_700Bold, weight: 700 },
      ],
    },
  ]);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
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

  if (!ready) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="profile-setup" options={{ animation: 'fade' }} />
          {/* No swipe-back out of the queue, a running game or the match moment. */}
          <Stack.Screen name="queue" options={{ gestureEnabled: false }} />
          {/* The room and the match arrive as moments, not as pages pushed on a stack. */}
          <Stack.Screen name="room/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="match/[id]" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
      </SessionProvider>
    </ThemeProvider>
  );
}
