import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import {
  api,
  getMockNextRole,
  isMockServer,
  setMockNextRole,
  type Match,
  type MockRole,
} from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Ease, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { PushPrompt } from '@/features/home/push-prompt';
import { SettingsButton } from '@/features/home/settings-button';
import { seatFor, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { ageFromBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';

/** The test server's role chips, labeled by their `home.*` keys. */
const MOCK_ROLES: { role: MockRole; label: string }[] = [
  { role: 'random', label: 'home.roleRandom' },
  { role: 'popper', label: 'home.rolePopper' },
  { role: 'contestant', label: 'home.roleBalloon' },
];

/** The matches arrive once the list has loaded, instead of flashing the empty state first. */
const listIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

export function HomeScreen() {
  const { profile } = useSession();
  const seats = useSeats();
  const theme = useTheme();
  const t = useT();
  /** Null until the first load, so the empty state never flashes before the rows. */
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockRole, setMockRole] = useState(getMockNextRole);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setJoining(false);
      api
        .listMatches()
        .then((list) => {
          if (active) setMatches(list);
        })
        // A failed load still shows the section: the last list, or the empty state.
        .catch(() => {
          if (active) setMatches((previous) => previous ?? []);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!profile) return <Redirect href="/" />;

  async function handlePlay() {
    setJoining(true);
    setError(null);
    try {
      await api.joinQueue();
      router.push('/queue');
    } catch {
      const message = t('home.joinError');
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
      setJoining(false);
    }
  }

  function chooseMockRole(role: MockRole) {
    setMockNextRole(role);
    setMockRole(role);
  }

  const hasMatches = (matches?.length ?? 0) > 0;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <Wordmark />
        <SettingsButton />
      </View>

      {/* The whole row opens your profile; the highlight reaches a little past the avatar. */}
      <PressableHighlight
        accessibilityRole="button"
        accessibilityLabel={t('home.editProfile')}
        onPress={() => router.push('/profile')}
        background="transparent"
        style={styles.you}>
        <Avatar name={profile.name} uri={profile.photos[0]} tone={youSeat(seats)} size={64} />
        <View style={styles.youText}>
          <ThemedText type="heading">{profile.name}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {ageFromBirthDate(profile.birthDate)} · {profile.city}
          </ThemedText>
        </View>
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={14} color={theme.textTertiary} />
        </View>
      </PressableHighlight>

      <View style={styles.play}>
        <Button
          title={t('home.play')}
          loading={joining}
          onPress={handlePlay}
          accessibilityHint={t('home.playHint')}
        />
        {error ? <ErrorLine message={error} /> : null}
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.centered}>
          {t('home.roleNote')}
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('home.howToPlay')}
          onPress={() => router.push('/how-to-play')}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [styles.howTo, pressed && styles.pressed]}>
          <ThemedText type="label" style={styles.link}>
            {t('home.howToPlay')}
          </ThemedText>
        </Pressable>
      </View>

      <PushPrompt style={styles.push} />

      {matches ? (
        <Animated.View entering={listIn} style={styles.matches}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('home.matches')}
          </ThemedText>
          {matches.length === 0 ? (
            <ThemedText type="callout" themeColor="textSecondary" style={styles.empty}>
              {t('home.noMatches')}
            </ThemedText>
          ) : (
            <View style={styles.list}>
              {matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </View>
          )}
        </Animated.View>
      ) : null}

      {/* On the page, not in a card, so the chips keep their filled shape at rest. */}
      {isMockServer ? (
        <View style={hasMatches ? styles.mockAfterRows : styles.mock}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('home.testServer')}
          </ThemedText>
          {/* Sized to their labels; larger text wraps them onto a second line. */}
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('home.roleGroup')}>
            {MOCK_ROLES.map(({ role, label }) => (
              <Chip
                key={role}
                label={t(label)}
                selected={mockRole === role}
                onPress={() => chooseMockRole(role)}
              />
            ))}
          </View>
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.mockNote}>
            {t('home.testNote')}
          </ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}

/** One match: a card with their avatar in their hue, their name and age, and a chevron. Opens your chat. */
function MatchRow({ match }: { match: Match }) {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  return (
    <PressableHighlight
      accessibilityRole="button"
      accessibilityLabel={t('common.nameAge', { name: match.other.name, age: match.other.age })}
      accessibilityHint={t('home.openChatHint')}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
      background={theme.field}
      style={[styles.row, { borderColor: theme.outline }]}>
      <Avatar
        name={match.other.name}
        uri={match.other.photo}
        tone={seatFor(seats, match.other.id)}
        size={40}
      />
      <ThemedText type="row" style={styles.flex}>
        {match.other.name},{' '}
        <ThemedText type="row" themeColor="textSecondary" style={styles.age}>
          {match.other.age}
        </ThemedText>
      </ThemedText>
      <View style={styles.chevron}>
        <Icon name="chevronRight" size={14} color={theme.textTertiary} />
      </View>
    </PressableHighlight>
  );
}

/** How far the profile row's pressed fill reaches past its content. */
const YOU_INSET = Space.sm;

const styles = StyleSheet.create({
  // Home starts 8pt lower than the other screens: the wordmark has the top to itself.
  content: {
    paddingTop: 20,
  },
  flex: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // The row sits where it did before it became a button: its padding is taken back by the margins.
  you: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginTop: 28 - YOU_INSET,
    marginHorizontal: -YOU_INSET,
    padding: YOU_INSET,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  youText: {
    flex: 1,
    gap: 2,
  },
  play: {
    gap: 10,
    marginTop: 28 - YOU_INSET,
  },
  // A 44pt target around one line of text, pulled in so it reads as part of the note above.
  howTo: {
    alignSelf: 'center',
    minHeight: MinTouch,
    justifyContent: 'center',
    paddingHorizontal: Space.sm,
    marginTop: -Space.xs,
    marginBottom: -Space.xs,
  },
  link: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
  push: {
    marginTop: Space.lg,
  },
  // More room above the list than between the groups above it.
  matches: {
    marginTop: 40,
  },
  empty: {
    marginTop: 6,
  },
  list: {
    gap: Space.xs,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 64,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  age: {
    fontWeight: 400,
  },
  // The chevron's 18pt slot, so the name ends where the canvas's does.
  chevron: {
    width: 18,
    alignItems: 'center',
  },
  mock: {
    marginTop: 36,
  },
  // A card ends flush, so the group sits a little closer to it than to a line of text.
  mockAfterRows: {
    marginTop: Space.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
    marginTop: Space.sm,
  },
  mockNote: {
    marginTop: 10,
  },
});
