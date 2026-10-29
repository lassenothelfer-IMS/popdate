import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, type SecondChance } from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { acknowledge } from '@/features/chat/prompts';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/**
 * "Almost": the runner-ups from rooms you chose in, whom you can give a second
 * chance, the ones you sent, and choosers who came back for you. Accepting one
 * makes a match and opens the chat. Renders nothing when there are none.
 */
export function SecondChances({ onMatched }: { onMatched?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const [chances, setChances] = useState<SecondChance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    api
      .listSecondChances()
      .then((list) => {
        if (active) setChances(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(load);

  async function send(chance: SecondChance) {
    setBusy(chance.id);
    try {
      await api.sendSecondChance(chance.roomId, chance.person.id);
      haptics.success();
      setChances((list) => list.map((c) => (c.id === chance.id ? { ...c, state: 'sent' } : c)));
    } catch {
      haptics.error();
      acknowledge(t('almost.failed'));
    } finally {
      setBusy(null);
    }
  }

  async function answer(chance: SecondChance, accept: boolean) {
    setBusy(chance.id);
    try {
      const match = await api.answerSecondChance(chance.id, accept);
      setChances((list) => list.filter((c) => c.id !== chance.id));
      if (match) {
        haptics.success();
        onMatched?.();
        router.push({ pathname: '/chat/[id]', params: { id: match.id } });
      }
    } catch {
      haptics.error();
      acknowledge(t('almost.failed'));
    } finally {
      setBusy(null);
    }
  }

  if (chances.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="kicker" accessibilityRole="header">
        {t('almost.title')}
      </ThemedText>
      {chances.map((chance) => {
        const name = t('common.nameAge', { name: chance.person.name, age: chance.person.age });
        const note =
          chance.state === 'incoming'
            ? t('almost.incoming')
            : chance.state === 'sent'
              ? t('almost.sent')
              : t('almost.runnerUp');
        return (
          <View
            key={chance.id}
            style={[styles.row, { backgroundColor: theme.field, borderColor: theme.border }]}>
            <View style={styles.person}>
              <Avatar
                name={chance.person.name}
                uri={chance.person.photo}
                tone={seatFor(seats, chance.person.id)}
                size={40}
              />
              <View style={styles.text}>
                <ThemedText type="headline">{name}</ThemedText>
                <ThemedText type="footnote" themeColor="textSecondary">
                  {note}
                </ThemedText>
              </View>
            </View>
            {chance.state === 'almost' ? (
              <Button
                title={t('almost.send')}
                variant="tinted"
                size="small"
                loading={busy === chance.id}
                disabled={busy !== null}
                onPress={() => void send(chance)}
              />
            ) : chance.state === 'incoming' ? (
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    title={t('almost.decline')}
                    variant="plain"
                    disabled={busy !== null}
                    onPress={() => void answer(chance, false)}
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    title={t('almost.accept')}
                    size="small"
                    loading={busy === chance.id}
                    disabled={busy !== null}
                    onPress={() => void answer(chance, true)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      <ThemedText type="footnote" themeColor="textTertiary">
        {t('almost.explain')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Space.lg,
    gap: Space.xs,
  },
  row: {
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  action: {
    flex: 1,
  },
});
