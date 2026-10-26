import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api, type BlockedPerson } from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { confirmAction, goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** The list arrives once it has loaded, instead of flashing the empty state first. */
const listIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

const UNBLOCK_HEIGHT = 36;

export function BlockedScreen() {
  const t = useT();
  /** Null until the first load. */
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fetchList() {
    return api.listBlocked().then(setPeople, () => setLoadFailed(true));
  }

  useEffect(() => {
    fetchList();
  }, []);

  function retry() {
    setLoadFailed(false);
    fetchList();
  }

  async function unblock(person: BlockedPerson) {
    const ok = await confirmAction({
      title: t('settings.unblockTitle', { name: person.name }),
      message: t('settings.unblockBody'),
      confirmLabel: t('settings.unblock'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    setError(null);
    setBusyId(person.id);
    try {
      await api.unblock(person.id);
      haptics.light();
      setPeople((list) => list?.filter((other) => other.id !== person.id) ?? null);
      AccessibilityInfo.announceForAccessibility(t('settings.unblocked', { name: person.name }));
    } catch {
      const message = t('common.somethingWrong');
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(SETTINGS_PAGE)} />
      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('settings.blocked')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.intro}>
        {t('settings.blockedIntro')}
      </ThemedText>

      {loadFailed ? (
        <View style={styles.failed}>
          <ErrorLine message={t('common.somethingWrong')} />
          <Button variant="secondary" title={t('common.tryAgain')} onPress={retry} />
        </View>
      ) : people ? (
        <Animated.View entering={listIn} style={styles.list}>
          {error ? <ErrorLine message={error} /> : null}
          {people.length === 0 ? (
            <ThemedText type="callout" themeColor="textSecondary">
              {t('settings.blockedEmpty')}
            </ThemedText>
          ) : (
            <View>
              {people.map((person, index) => (
                <BlockedRow
                  key={person.id}
                  person={person}
                  last={index === people.length - 1}
                  busy={busyId === person.id}
                  disabled={busyId !== null}
                  onUnblock={() => unblock(person)}
                />
              ))}
            </View>
          )}
        </Animated.View>
      ) : null}
    </Screen>
  );
}

type BlockedRowProps = {
  person: BlockedPerson;
  last: boolean;
  busy: boolean;
  disabled: boolean;
  onUnblock: () => void;
};

/** Their avatar, name and age, and Unblock. */
function BlockedRow({ person, last, busy, disabled, onUnblock }: BlockedRowProps) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const slop = (MinTouch - UNBLOCK_HEIGHT) / 2;
  const nameAge = person.age
    ? t('common.nameAge', { name: person.name, age: person.age })
    : person.name;
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }, last && styles.lastRow]}>
      <Avatar name={person.name} uri={person.photo} tone={seatFor(seats, person.id)} size={40} />
      <ThemedText type="row" style={styles.name} accessibilityLabel={nameAge}>
        {person.name}
        {person.age ? (
          <>
            ,{' '}
            <ThemedText type="row" themeColor="textSecondary" style={styles.age}>
              {person.age}
            </ThemedText>
          </>
        ) : null}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.unblockName', { name: person.name })}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={onUnblock}
        hitSlop={{ top: slop, bottom: slop }}
        style={({ pressed }) => [
          styles.unblock,
          { backgroundColor: pressed ? theme.surfacePressed : theme.surface },
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <ThemedText type="label">{t('settings.unblock')}</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Space.md,
  },
  intro: {
    marginTop: 10,
  },
  failed: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  list: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  name: {
    flex: 1,
  },
  age: {
    fontWeight: 400,
  },
  unblock: {
    minHeight: UNBLOCK_HEIGHT,
    minWidth: 88,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
