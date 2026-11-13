import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CLEARANCE, useTabFocus } from '@/components/tab-bar';
import { Button } from '@/components/button';
import { api, type PinnedAnswer, type VerificationStatus } from '@/api';
import { Icon, type IconName } from '@/components/icon';
import { Photo } from '@/components/photo';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Prompt } from '@/components/prompt';
import { Rise } from '@/components/rise';
import { TextLink } from '@/components/text-link';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { VerifiedCheck } from '@/components/verified-check';
import { Gutter, MinTouch, Radius, Space } from '@/constants/theme';
import { useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { asSexuality, identityLabel, identityOf, sexualityLabel } from '@/features/profile/identity';
import { interestLabel, languageLabel } from '@/features/profile/tags-section';
import { useT } from '@/i18n';
import { cleanInterests, cleanLanguages } from '@/shared/profile-tags';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { ageFromBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';
import { formatHeight } from '@/utils/units';

/** Every photo is a 4:5 portrait, as wide as the screen. */
const PHOTO_RATIO = 4 / 5;

/** The narrowest a stat tile gets in the single row; below it the tiles go two by two. */
const STAT_MIN_WIDTH = 80;

/**
 * Your profile as others meet it, the way Hinge lays one out: photo 1 as wide
 * as the screen, your name under it, your bio and what you filled in, then
 * your other photos down the page with your pinned answers between them, and
 * your verification. Edit opens the editor. As the You tab it also shows your
 * numbers, and a gear for Settings takes the place of Back.
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
  const photos = profile.photos.length ? profile.photos : ['mock://'];
  const pins = profile.pinnedAnswers ?? [];
  // After the first photo: a photo, then a pinned answer, for as long as either lasts.
  const turns = Math.max(photos.length - 1, pins.length);
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
    {
      label: t('profile.interests'),
      value: cleanInterests(profile.interests)
        .map((interest) => interestLabel(t, interest))
        .join(', '),
    },
    {
      label: t('profile.languages'),
      value: cleanLanguages(profile.languages)
        .map((language) => languageLabel(t, language))
        .join(', '),
    },
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
        {/* Photo 1, as wide as the screen; the buttons float over its top. */}
        <View>
          <YouPhoto uri={photos[0]} name={profile.name} width={width} label={t('profile.photoMenuTitle', { position: 1 })} />
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
        </View>

        <View style={styles.body}>
          {/* Your name under your face, large; no shade over the photo. */}
          <Rise index={0} style={styles.who}>
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
            {profile.city ? <ThemedText type="body">{profile.city}</ThemedText> : null}
          </Rise>

          {/* Setup only asks for a name and photos: here, after you've played, is where the rest is asked for. */}
          {asTab && !profile.bio && !profile.job ? (
            <Rise index={0} style={styles.nudge}>
              <ThemedText type="heading" accessibilityRole="header">
                {t('profile.nudgeTitle')}
              </ThemedText>
              <ThemedText type="body">{t('profile.nudgeBody')}</ThemedText>
              <TextLink title={t('profile.nudgeAction')} onPress={() => router.push('/profile')} />
            </Rise>
          ) : null}
          {profile.bio ? (
            <Rise index={0}>
              <ThemedText type="quote" style={styles.bio}>
                {`“${profile.bio}”`}
              </ThemedText>
            </Rise>
          ) : null}

          <Rise index={1} style={styles.pins}>
            <ThemedText type="headline" accessibilityRole="header">
              {t('profile.aboutYou')}
            </ThemedText>
            <View style={styles.about}>
              {about.map((row, index) => (
                <View
                  key={row.label}
                  accessible
                  accessibilityLabel={`${row.label}, ${row.value}`}
                  style={[styles.aboutRow, index > 0 && [styles.aboutRule, { borderTopColor: theme.border }]]}>
                  <ThemedText type="callout" themeColor="textSecondary">
                    {row.label}
                  </ThemedText>
                  <ThemedText type="body">{row.value}</ThemedText>
                </View>
              ))}
            </View>
          </Rise>

          {asTab && stats ? (
            <Rise index={1} style={[styles.stats, { borderColor: theme.border }, statGrid && styles.statsGrid]}>
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

          {Array.from({ length: turns }, (_, index) => {
            const uri = photos[index + 1];
            const pin = pins[index];
            return (
              <View key={`turn-${index}`} style={styles.turn}>
                {uri ? (
                  <YouPhoto
                    uri={uri}
                    name={profile.name}
                    width={width}
                    label={t('profile.photoMenuTitle', { position: index + 2 })}
                    bleed
                  />
                ) : null}
                {pin ? (
                  <View style={styles.pin}>
                    <Prompt question={pin.question} answer={pin.answer} size="large" />
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
                ) : null}
              </View>
            );
          })}

          {asTab && pins.length === 0 ? (
            <Rise index={1} style={styles.pins}>
              <ThemedText type="headline" accessibilityRole="header">
                {t('you.pinnedTitle')}
              </ThemedText>
              <ThemedText type="body">{t('you.pinnedEmpty')}</ThemedText>
            </Rise>
          ) : null}

          {verification ? (
            <Rise index={1}>
              <PressableHighlight
                accessibilityRole="button"
                accessibilityLabel={verified ? t('home.verifiedTitle') : t('home.unverifiedTitle')}
                disabled={verified}
                onPress={() => router.push('/settings/verify' as Href)}
                background={theme.page}
                style={[styles.verify, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
                <View style={[styles.verifyIcon, { backgroundColor: theme.accentWash }]}>
                  <VerifiedCheck size={16} />
                </View>
                <View style={styles.verifyText}>
                  <ThemedText type="headline">
                    {verified ? t('home.verifiedTitle') : t('home.unverifiedTitle')}
                  </ThemedText>
                  <ThemedText type="body">
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
      style={[styles.stat, half && styles.statHalf, { borderLeftColor: theme.border }]}>
      <ThemedText type="display" style={styles.statValue}>
        {String(value)}
      </ThemedText>
      <ThemedText type="callout" numberOfLines={2} style={styles.statLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * One of your photos: a 4:5 portrait as wide as the screen, cropped from the
 * top so a face keeps its forehead. `bleed` pulls it out of the page's side
 * margins, for a photo further down the page.
 */
function YouPhoto({
  uri,
  name,
  width,
  label,
  bleed = false,
}: {
  uri: string;
  name: string;
  width: number;
  label: string;
  bleed?: boolean;
}) {
  const seats = useSeats();
  return (
    <View
      style={[
        { width, height: width / PHOTO_RATIO },
        bleed && styles.bleed,
      ]}>
      <Photo
        uri={uri}
        name={name}
        tone={youSeat(seats)}
        hairline={false}
        accessibilityLabel={label}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * A button over the photo: a circle with an icon, or a pill with its label. On iOS 26
 * it is Liquid Glass with a light tint, so its dark ink holds on a dark photo; elsewhere
 * a solid light pill.
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
      variant="glass"
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
  // Four numbers in a row between two hairlines, not four tiles.
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.sm,
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
    paddingHorizontal: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  nudge: {
    gap: Space.xs,
    alignItems: 'flex-start',
  },
  pins: {
    gap: Space.xs,
  },
  pin: {
    gap: 4,
    paddingTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  // A photo further down the page reaches past the page's side margins to the screen's edges.
  bleed: {
    marginHorizontal: -Gutter,
  },
  who: {
    gap: Space.xxs,
  },
  turn: {
    gap: Space.xl,
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
  about: {},
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
