import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { TAB_BAR_CLEARANCE, useTabActive, useTabFocus } from '@/components/tab-bar';
import { Button } from '@/components/button';
import { api, type VerificationStatus } from '@/api';
import { Icon } from '@/components/icon';
import { Photo } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { ThemedText } from '@/components/themed-text';
import { VerifiedCheck } from '@/components/verified-check';
import { Gutter, MinTouch, PhotoGlass, Radius, Space, Velvet } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useScheme, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { identityLine } from '@/features/profile/identity';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { ageFromBirthDate } from '@/utils/birth-date';
import { formatHeight } from '@/utils/units';

/** The hero photo's height on a 844 pt phone. It grows when the name and lines under it need more. */
const HERO = 460;

/**
 * Your profile as others meet it: photo 1 big at the top with your name over
 * it, your bio, the answers you pinned, and your verification. Edit opens the
 * editor. As the You tab it also shows your numbers, and a gear for Settings
 * takes the place of Back.
 */
export function ProfileViewScreen({ asTab = false }: { asTab?: boolean }) {
  const { profile } = useSession();
  const { settings } = useSettings();
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { history, reload: reloadHistory } = useRoomHistory();
  const stats = history ? roomStats(history) : null;

  const loadVerification = useCallback(
    (isCurrent: () => boolean = () => true) =>
      api.getVerification().then(
        (status) => {
          if (isCurrent()) setVerification(status);
        },
        () => {},
      ),
    [],
  );

  useTabFocus(
    useCallback(() => {
      let active = true;
      void loadVerification(() => active);
      return () => {
        active = false;
      };
    }, [loadVerification]),
  );

  function refresh() {
    setRefreshing(true);
    const done = () => setRefreshing(false);
    Promise.all([loadVerification(), reloadHistory()]).then(done, done);
  }

  if (!profile) return <Redirect href="/" />;

  const verified = verification === 'verified';
  const name = t('common.nameAge', { name: profile.name, age: ageFromBirthDate(profile.birthDate) });
  const meta = [
    profile.city,
    profile.heightCm ? formatHeight(profile.heightCm, settings.units) : null,
    profile.job,
  ]
    .filter(Boolean)
    .join(', ');

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.page }]}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: asTab ? TAB_BAR_CLEARANCE : insets.bottom + Space.xl }}
        // The web has no pull gesture to answer.
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
              progressBackgroundColor={theme.sheet}
            />
          ) : undefined
        }>
        {/* The name and its lines sit in the flow under the buttons, so a long city or
            a large text size grows the hero instead of climbing over the photo dots. */}
        <View style={[styles.hero, { paddingTop: insets.top + Space.xs + MinTouch + Space.lg }]}>
          <HeroPhoto uri={profile.photos[0] ?? 'mock://'} name={profile.name} />
          <HeroScrim />
          <View style={[styles.heroTop, { top: insets.top + Space.xs }]}>
            {asTab ? (
              <GlassButton label={t('home.settings')} onPress={() => router.push('/settings' as Href)}>
                <Icon name="gear" size={17} color={Velvet.cream} />
              </GlassButton>
            ) : (
              <GlassButton label={t('common.back')} onPress={back}>
                <Icon name="back" size={16} color={Velvet.cream} />
              </GlassButton>
            )}
            <GlassButton label={t('home.profileEdit')} onPress={() => router.push('/profile')} pill>
              <ThemedText type="kicker" style={styles.onPhoto}>
                {t('home.profileEdit')}
              </ThemedText>
            </GlassButton>
          </View>
          <View style={styles.heroText}>
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {profile.photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={[styles.dot, index === 0 ? styles.dotActive : styles.dotRest]} />
              ))}
            </View>
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
            <ThemedText type="callout" themeColor="textSecondary">
              {identityLine(t, profile)}
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

          {asTab && stats ? (
            <Rise index={1} style={styles.stats}>
              <Stat value={stats.played} label={t('you.statRooms', { count: stats.played })} />
              <Stat value={stats.lastBalloon} label={t('you.statLastBalloon', { count: stats.lastBalloon })} />
              <Stat value={stats.chooser} label={t('you.statChooser', { count: stats.chooser })} />
              <Stat value={stats.streak} label={t('you.statStreak', { count: stats.streak })} />
            </Rise>
          ) : null}

          {profile.pinnedAnswers?.length ? (
            <Rise index={1} style={styles.pins}>
              <ThemedText type="kicker" accessibilityRole="header">
                {t('you.pinnedTitle')}
              </ThemedText>
              {profile.pinnedAnswers.map((pin) => (
                <View
                  key={`${pin.question}|${pin.answer}`}
                  style={[styles.pin, { backgroundColor: theme.field, borderColor: theme.border }]}>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {pin.question}
                  </ThemedText>
                  <ThemedText type="questionRow">{`“${pin.answer}”`}</ThemedText>
                </View>
              ))}
            </Rise>
          ) : asTab ? (
            <Rise index={1} style={styles.pins}>
              <ThemedText type="kicker" accessibilityRole="header">
                {t('you.pinnedTitle')}
              </ThemedText>
              <ThemedText type="footnote" themeColor="textSecondary">
                {t('you.pinnedEmpty')}
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

/** One of your numbers: big, with what it counts under it. */
function Stat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, { backgroundColor: theme.field, borderColor: theme.border }]}>
      <ThemedText type="heading" style={styles.statValue}>
        {String(value)}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** One drift in or out. */
const DRIFT_MS = 14000;

/**
 * Photo 1, slowly drifting in (Ken Burns, 1 to 1.08 over 14 s). A placeholder is
 * your tint tile with two soft circles of your balloon color. Holds still under
 * Reduce Motion, and while the You page is off screen.
 */
function HeroPhoto({ uri, name }: { uri: string; name: string }) {
  const seats = useSeats();
  const you = youSeat(seats);
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const showing = useTabActive();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(drift);
      drift.set(0);
      return;
    }
    if (!showing) {
      cancelAnimation(drift);
      return;
    }
    // Drifts on from wherever it paused, so the photo doesn't jump when you page back.
    const easing = Easing.inOut(Easing.ease);
    const from = drift.get();
    drift.set(
      withSequence(
        withTiming(1, { duration: DRIFT_MS * (1 - from), easing }),
        withRepeat(withTiming(0, { duration: DRIFT_MS, easing }), -1, true),
      ),
    );
  }, [reduced, showing, drift]);
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
        <Svg width={width} height="100%">
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
  // Fills the hero at whatever height it grew to.
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={theme.page} stopOpacity={1} />
          <Stop offset="0.3" stopColor={ink} stopOpacity={0.6} />
          <Stop offset="0.6" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
  );
}

/** A glass button over the photo: a circle with an icon, or a pill with its label. */
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
  return (
    <Button
      title={label}
      variant="glass"
      size="small"
      fullWidth={false}
      iconOnly={!pill}
      icon={pill ? undefined : children}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.sm,
    paddingHorizontal: 4,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    textAlign: 'center',
  },
  pins: {
    gap: Space.xs,
  },
  pin: {
    gap: 4,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    minHeight: HERO,
    justifyContent: 'flex-end',
    paddingHorizontal: Gutter,
    paddingBottom: 24,
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
  dots: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: Space.md,
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
    backgroundColor: PhotoGlass.dot,
  },
  heroText: {
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
