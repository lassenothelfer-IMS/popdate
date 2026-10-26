import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { api, type VerificationStatus } from '@/api';
import { Icon } from '@/components/icon';
import { Photo } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { ThemedText } from '@/components/themed-text';
import { VerifiedCheck } from '@/components/verified-check';
import { Gutter, MinTouch, Radius, Space, Velvet } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useScheme, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { ageFromBirthDate } from '@/utils/birth-date';
import { formatHeight } from '@/utils/units';

/** The hero photo's height on a 844 pt phone. */
const HERO = 460;

/**
 * Your profile as others meet it: photo 1 big at the top with your name over
 * it, your bio, and your verification. Edit opens the editor.
 */
export function ProfileViewScreen() {
  const { profile } = useSession();
  const { settings } = useSettings();
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [verification, setVerification] = useState<VerificationStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .getVerification()
        .then((status) => {
          if (active) setVerification(status);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  if (!profile) return <Redirect href="/" />;

  const verified = verification === 'verified';
  const name = t('common.nameAge', { name: profile.name, age: ageFromBirthDate(profile.birthDate) });
  const meta = [profile.city, formatHeight(profile.heightCm, settings.units), profile.job]
    .filter(Boolean)
    .join(', ');

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.page }]}>
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Space.xl }}>
        <View style={styles.hero}>
          <HeroPhoto uri={profile.photos[0] ?? 'mock://'} name={profile.name} />
          <HeroScrim />
          <View style={[styles.heroTop, { top: insets.top + Space.xs }]}>
            <GlassButton label={t('common.back')} onPress={back}>
              <Icon name="back" size={16} color={Velvet.cream} />
            </GlassButton>
            <GlassButton label={t('home.profileEdit')} onPress={() => router.push('/profile')} pill>
              <ThemedText type="kicker" style={styles.onPhoto}>
                {t('home.profileEdit')}
              </ThemedText>
            </GlassButton>
          </View>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {profile.photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={[styles.dot, index === 0 ? styles.dotActive : styles.dotRest]} />
            ))}
          </View>
          <View style={styles.heroText}>
            <View
              style={styles.nameRow}
              accessible
              accessibilityRole="header"
              accessibilityLabel={verified ? `${name}, ${t('home.verifiedLabel')}` : name}>
              <ThemedText type="title" maxFontSizeMultiplier={1.3}>
                {name}
              </ThemedText>
              {verified ? <VerifiedCheck /> : null}
            </View>
            <ThemedText type="callout" themeColor="textSecondary">
              {meta}
            </ThemedText>
          </View>
        </View>

        <View style={styles.body}>
          {profile.bio ? (
            <Rise index={0}>
              <ThemedText type="quote" style={styles.bio}>
                {`“${profile.bio}”`}
              </ThemedText>
            </Rise>
          ) : null}

          {verification ? (
            <Rise index={1}>
              <PressableHighlight
                accessibilityRole="button"
                accessibilityLabel={verified ? t('home.verifiedTitle') : t('home.unverifiedTitle')}
                disabled={verified}
                onPress={() => router.push('/settings/verify' as Href)}
                background={theme.field}
                style={[styles.verify, { borderColor: theme.border }]}>
                <View style={[styles.verifyIcon, { backgroundColor: theme.accentWash }]}>
                  <VerifiedCheck size={16} />
                </View>
                <View style={styles.verifyText}>
                  <ThemedText type="headline">
                    {verified ? t('home.verifiedTitle') : t('home.unverifiedTitle')}
                  </ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {verified ? t('home.verifiedNote') : t('home.unverifiedNote')}
                  </ThemedText>
                </View>
                <ThemedText type="kicker" themeColor={verified ? 'success' : 'accentText'}>
                  {verified ? t('home.verifiedActive') : t('home.verifyAction')}
                </ThemedText>
              </PressableHighlight>
            </Rise>
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Photo 1, slowly drifting in (Ken Burns, 1 to 1.08 over 14 s). A placeholder is
 * your tint tile with two soft circles of your balloon color.
 */
function HeroPhoto({ uri, name }: { uri: string; name: string }) {
  const seats = useSeats();
  const you = youSeat(seats);
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(drift);
      drift.set(0);
      return;
    }
    drift.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, drift]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * drift.get() }] }));

  if (!uri.startsWith('mock://')) {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Photo uri={uri} name={name} hairline={false} style={StyleSheet.absoluteFill} />
      </Animated.View>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: you.tint }]}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Svg width={width} height={HERO}>
          <Defs>
            <RadialGradient id="heroBlobA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={you.hi} stopOpacity={0.7} />
              <Stop offset="1" stopColor={you.hi} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="heroBlobB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={you.color} stopOpacity={0.6} />
              <Stop offset="1" stopColor={you.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={-100} y={0} width={400} height={400} fill="url(#heroBlobA)" />
          <Rect x={width - 300} y={140} width={440} height={440} fill="url(#heroBlobB)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The photo scrim: the canvas rising from the bottom so the name reads. */
function HeroScrim() {
  const theme = useTheme();
  const ink = useScheme() === 'dark' ? theme.page : theme.text;
  const { width } = useWindowDimensions();
  return (
    <Svg width={width} height={HERO} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={theme.page} stopOpacity={1} />
          <Stop offset="0.3" stopColor={ink} stopOpacity={0.6} />
          <Stop offset="0.6" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={HERO} fill="url(#heroScrim)" />
    </Svg>
  );
}

/** A 40 pt glass circle (or pill) over the photo. */
function GlassButton({
  label,
  onPress,
  pill = false,
  children,
}: {
  label: string;
  onPress: () => void;
  pill?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const glass = useScheme() === 'dark' ? theme.page : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        pill ? styles.glassPill : styles.glassCircle,
        { backgroundColor: `${glass}73` },
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    height: HERO,
    overflow: 'hidden',
  },
  heroTop: {
    position: 'absolute',
    left: Gutter,
    right: Gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassPill: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  dots: {
    position: 'absolute',
    left: Gutter,
    bottom: 110,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    height: 3,
    borderRadius: 2,
  },
  dotActive: {
    width: 22,
    backgroundColor: Velvet.cream,
  },
  dotRest: {
    width: 8,
    backgroundColor: 'rgba(246, 234, 230, 0.4)',
  },
  heroText: {
    position: 'absolute',
    left: Gutter,
    right: Gutter,
    bottom: 24,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: MinTouch,
  },
  // The Edit label sits on dark glass in both themes.
  onPhoto: {
    color: Velvet.cream,
  },
  body: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    gap: Space.lg,
  },
  bio: {
    fontSize: 19,
    lineHeight: 25,
  },
  verify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifyIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyText: {
    flex: 1,
    gap: 1,
  },
});
