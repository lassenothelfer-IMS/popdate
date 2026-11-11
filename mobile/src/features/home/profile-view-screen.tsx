import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type NativeSyntheticEvent,
} from 'react-native';
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
import { api, type PinnedAnswer, type VerificationStatus } from '@/api';
import { Icon, type IconName } from '@/components/icon';
import { Photo } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { VerifiedCheck } from '@/components/verified-check';
import { Gutter, MinTouch, PhotoGlass, Radius, Space, Velvet } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { asSexuality, identityLabel, identityOf, sexualityLabel } from '@/features/profile/identity';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { ageFromBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';
import { formatHeight } from '@/utils/units';

/** The hero photo's height on a 844 pt phone. It grows when the name and lines under it need more. */
const HERO = 460;

/** The narrowest a stat tile gets in the single row; below it the tiles go two by two. */
const STAT_MIN_WIDTH = 80;

/** The space under the name block, to the photo's foot. */
const HERO_FOOT = 24;

/** How far above the name the photo scrim fades in. */
const SCRIM_FADE = 120;

/**
 * Your profile as others meet it: photo 1 big at the top with your name and
 * city over it, your bio, everything else you filled in, the answers you
 * pinned, and your verification. The photo pages sideways through all your photos. Edit opens the editor. As
 * the You tab it also shows your numbers, and a gear for Settings takes the
 * place of Back.
 */
export function ProfileViewScreen({ asTab = false }: { asTab?: boolean }) {
  const { profile, updateProfile } = useSession();
  const { settings } = useSettings();
  const { show, toast } = useToast();
  const [unpinning, setUnpinning] = useState(false);
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { history, reload: reloadHistory } = useRoomHistory();
  const stats = history ? roomStats(history) : null;
  // Four tiles in one row need about 80 pt each (scaled with text size) for labels
  // like "times choosing" to break cleanly. Narrower than that (an SE, or large
  // text), they go two by two.
  const { width, fontScale } = useWindowDimensions();
  const statGrid = (width - 2 * Gutter - 3 * Space.xs) / 4 / fontScale < STAT_MIN_WIDTH;
  /** The photo showing in the hero, which the dashes over the name follow. */
  const [photoIndex, setPhotoIndex] = useState(0);

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

  /** Takes a pinned answer off your profile, right here instead of from Rooms. */
  async function unpin(pin: PinnedAnswer) {
    if (!profile || unpinning) return;
    haptics.light();
    setUnpinning(true);
    try {
      await updateProfile({
        pinnedAnswers: (profile.pinnedAnswers ?? []).filter(
          (p) => p.question !== pin.question || p.answer !== pin.answer,
        ),
      });
      show(t('rooms.unpinned'));
    } catch {
      haptics.error();
      show(t('rooms.pinFailed'));
    } finally {
      setUnpinning(false);
    }
  }

  function refresh() {
    setRefreshing(true);
    const done = () => setRefreshing(false);
    Promise.all([loadVerification(), reloadHistory()]).then(done, done);
  }

  if (!profile) return <Redirect href="/" />;

  const verified = verification === 'verified';
  const name = t('common.nameAge', { name: profile.name, age: ageFromBirthDate(profile.birthDate) });
  const sexuality = asSexuality(profile.sexuality);
  /** What you filled in about yourself, under the photo: only what's there. Gender is always set. */
  const about = [
    { label: t('profile.jobOrSchool'), value: profile.job.trim() },
    {
      label: t('profile.height'),
      value: profile.heightCm ? formatHeight(profile.heightCm, settings.units) : '',
    },
    {
      label: t('profile.gender'),
      value: [identityLabel(t, identityOf(profile)), profile.genderDetails?.trim()]
        .filter(Boolean)
        .join(' · '),
    },
    { label: t('profile.sexuality'), value: sexuality ? sexualityLabel(t, sexuality) : '' },
  ].filter((row) => row.value);

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
          <HeroPhotos
            photos={profile.photos.length ? profile.photos : ['mock://']}
            name={profile.name}
            width={width}
            index={photoIndex}
            onIndex={setPhotoIndex}
            label={(position) => t('profile.photoMenuTitle', { position })}
          />
          <View style={[styles.heroTop, { top: insets.top + Space.xs }]}>
            {asTab ? (
              <GlassButton
                label={t('home.settings')}
                onPress={() => router.push('/settings' as Href)}
                icon="gear"
                iconSize={17}
              />
            ) : (
              <GlassButton label={t('common.back')} onPress={back} icon="back" iconSize={16} />
            )}
            <GlassButton label={t('home.profileEdit')} onPress={() => router.push('/profile')} />
          </View>
          {/* Touches fall through to the photos, so a swipe over the name still pages them. */}
          <View style={styles.heroText} pointerEvents="none">
            <HeroScrim />
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {profile.photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={[styles.dot, index === photoIndex ? styles.dotActive : styles.dotRest]} />
              ))}
            </View>
            <View
              style={styles.nameRow}
              accessible
              accessibilityRole="header"
              accessibilityLabel={verified ? `${name}, ${t('home.verifiedLabel')}` : name}>
              <ThemedText type="title" maxFontSizeMultiplier={1.3} style={styles.onPhoto}>
                {name}
              </ThemedText>
              {verified ? <VerifiedCheck /> : null}
            </View>
            {profile.city ? (
              <ThemedText type="callout" style={styles.onPhotoFaint}>
                {profile.city}
              </ThemedText>
            ) : null}
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

          <Rise index={1} style={styles.pins}>
            <ThemedText type="kicker" accessibilityRole="header">
              {t('profile.aboutYou')}
            </ThemedText>
            <View style={[styles.about, { backgroundColor: theme.field, borderColor: theme.border }]}>
              {about.map((row, index) => (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={`${row.label}, ${row.value}`}
                  style={[styles.aboutRow, index > 0 && [styles.aboutRule, { borderTopColor: theme.border }]]}>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {row.label}
                  </ThemedText>
                  <ThemedText type="body">{row.value}</ThemedText>
                </View>
              ))}
            </View>
          </Rise>

          {asTab && stats ? (
            <Rise index={1} style={[styles.stats, statGrid && styles.statsGrid]}>
              <Stat half={statGrid} value={stats.played} label={t('you.statRooms', { count: stats.played })} />
              <Stat
                half={statGrid}
                value={stats.lastBalloon}
                label={t('you.statLastBalloon', { count: stats.lastBalloon })}
              />
              <Stat half={statGrid} value={stats.chooser} label={t('you.statChooser', { count: stats.chooser })} />
              <Stat half={statGrid} value={stats.streak} label={t('you.statStreak', { count: stats.streak })} />
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
                  <View style={styles.pinTop}>
                    <ThemedText type="footnote" themeColor="textSecondary" style={styles.pinQuestion}>
                      {pin.question}
                    </ThemedText>
                    {asTab ? (
                      <Button
                        title={t('home.unpin')}
                        variant="plain"
                        size="small"
                        fullWidth={false}
                        disabled={unpinning}
                        accessibilityHint={t('home.unpinHint')}
                        onPress={() => void unpin(pin)}
                        style={styles.unpin}
                      />
                    ) : null}
                  </View>
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
      {toast}
    </View>
  );
}

/** One of your numbers: big, with what it counts under it. */
function Stat({ value, label, half }: { value: number; label: string; half: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.stat, half && styles.statHalf, { backgroundColor: theme.field, borderColor: theme.border }]}>
      <ThemedText type="heading" style={styles.statValue}>
        {String(value)}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2} style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/** One drift in or out. */
const DRIFT_MS = 14000;

type HeroPhotosProps = {
  photos: string[];
  name: string;
  /** The window's width: each photo is one page of it. */
  width: number;
  index: number;
  onIndex: (index: number) => void;
  /** What VoiceOver calls a photo, by its position from 1. */
  label: (position: number) => string;
};

/**
 * Your photos behind the name, one page each: swipe sideways, or tap the right
 * or left half, to move through them.
 */
function HeroPhotos({ photos, name, width, index, onIndex, label }: HeroPhotosProps) {
  const ref = useRef<ScrollViewInstance>(null);
  const reduced = useReduceMotion();
  const [height, setHeight] = useState(0);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    const next = Math.min(photos.length - 1, Math.max(0, page));
    if (next !== index) onIndex(next);
  }
  function step(by: number) {
    const next = index + by;
    if (next < 0 || next >= photos.length) return;
    haptics.selection();
    ref.current?.scrollTo({ x: next * width, animated: !reduced });
  }

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={StyleSheet.absoluteFill}>
      {photos.map((uri, i) => (
        <Pressable
          key={`${uri}-${i}`}
          accessibilityRole="image"
          accessibilityLabel={label(i + 1)}
          // pageX, not locationX: the web reports no locationX, and each page spans the window.
          onPress={(event) => step(event.nativeEvent.pageX > width / 2 ? 1 : -1)}
          style={[styles.heroPage, { width, height }]}>
          <HeroPhoto uri={uri} name={name} active={i === index} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * One photo, slowly drifting in while it is the one showing (Ken Burns, 1 to
 * 1.08 over 14 s). A placeholder is your tint tile with two soft circles of your
 * balloon color. Holds still under Reduce Motion, and while the You page is off screen.
 */
function HeroPhoto({ uri, name, active }: { uri: string; name: string; active: boolean }) {
  const seats = useSeats();
  const you = youSeat(seats);
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const showing = useTabActive() && active;
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

/**
 * The photo scrim: the deep ink behind the name, the photo dots and the city, at
 * .75 to the photo's foot, fading out over 120 pt above them. It sits behind the
 * text, so it covers it at any text size, and the cream name reads on any
 * photo, light or dark. The photo then ends in a clean edge on the page.
 */
function HeroScrim() {
  return (
    <View style={styles.scrim} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {/* In points from the top: clear at 0, full at SCRIM_FADE, and full on down from there. */}
          <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2={SCRIM_FADE} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={Velvet.deep} stopOpacity={0} />
            <Stop offset="0.3" stopColor={Velvet.deep} stopOpacity={0.12} />
            <Stop offset="0.65" stopColor={Velvet.deep} stopOpacity={0.5} />
            <Stop offset="1" stopColor={Velvet.deep} stopOpacity={0.75} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#heroScrim)" />
      </Svg>
    </View>
  );
}

/**
 * A button over the photo: a circle with an icon, or a pill with its label. A solid
 * light pill, not glass: glass takes on a dark photo and its dark ink disappears.
 */
function GlassButton({
  label,
  onPress,
  icon,
  iconSize = 17,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconSize?: number;
}) {
  const theme = useTheme();
  const ink = theme.text;
  return (
    <Button
      title={label}
      variant="tinted"
      size="small"
      fullWidth={false}
      iconOnly={icon !== undefined}
      icon={icon ? <Icon name={icon} size={iconSize} color={ink} /> : undefined}
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
  // Two per row: a 40% basis leaves room for the gap and flex grows each to half; rows stretch tiles to one height.
  statsGrid: {
    flexWrap: 'wrap',
  },
  statHalf: {
    flexBasis: '40%',
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
  pinTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  pinQuestion: {
    flex: 1,
  },
  // Keeps the 44 pt target without pushing the card taller.
  unpin: {
    marginVertical: -Space.sm,
    marginRight: -Space.xs,
  },
  hero: {
    minHeight: HERO,
    justifyContent: 'flex-end',
    paddingHorizontal: Gutter,
    paddingBottom: HERO_FOOT,
    overflow: 'hidden',
  },
  // Above the scrim, which can reach up to the buttons at large text sizes.
  heroPage: {
    overflow: 'hidden',
  },
  heroTop: {
    position: 'absolute',
    left: Gutter,
    right: Gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  // From SCRIM_FADE above the name block to the photo's foot and edges (the hero's padding).
  scrim: {
    position: 'absolute',
    top: -SCRIM_FADE,
    bottom: -HERO_FOOT,
    left: -Gutter,
    right: -Gutter,
  },
  onPhoto: {
    color: Velvet.cream,
  },
  onPhotoFaint: {
    color: Velvet.faint,
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
  body: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    gap: Space.lg,
  },
  bio: {
    fontSize: 19,
    lineHeight: 25,
  },
  about: {
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aboutRow: {
    gap: 2,
    paddingVertical: Space.sm,
  },
  aboutRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
