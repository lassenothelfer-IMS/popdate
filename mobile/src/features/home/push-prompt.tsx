import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useT } from '@/i18n';
import { readJson, writeJson } from '@/utils/device-store';
import { haptics } from '@/utils/haptics';
import { enablePush, getPushPermission } from '@/utils/push';

/** Where the app asks: while you wait for your first room, then once more at your first match. */
export type PushMoment = 'queue' | 'match';

/** Each moment asks once per phone; after both, only Settings turns pushes on. */
const ASKED_KEY: Record<PushMoment, string> = {
  queue: 'popdate.pushAsked.queue',
  match: 'popdate.pushAsked.match',
};

type PushPrimerProps = {
  moment: PushMoment;
  /** Who you matched with, for the match's version of the question. */
  name?: string;
  /** While false (the room just filled, say) it stays closed. */
  active?: boolean;
  /** How long to wait before asking, so it never lands on top of what just happened. */
  delayMs?: number;
};

/**
 * The app's own question before iOS's: a sheet that says what pushes are for
 * right now ("a nudge when your room fills"), and only "Yes" shows the
 * system's prompt, which iOS shows once in an app's life. "Not now" leaves it
 * for the next moment. Never asked at launch, and never when it's been answered.
 */
export function PushPrimer({ moment, name, active = true, delayMs = 2500 }: PushPrimerProps) {
  const t = useT();
  const [due, setDue] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const [permission, asked] = await Promise.all([
          getPushPermission(),
          readJson<boolean>(ASKED_KEY[moment]),
        ]);
        if (live && permission === 'undetermined' && !asked) setDue(true);
      } catch {
        // Can't tell: stay quiet rather than ask at the wrong time.
      }
    }, delayMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [moment, delayMs]);

  function done() {
    void writeJson(ASKED_KEY[moment], true);
    setDue(false);
  }

  async function yes() {
    haptics.selection();
    setAsking(true);
    try {
      await enablePush();
    } catch {
      // Whatever iOS answered, the question has been asked.
    }
    // Answered for good: neither moment asks again.
    void writeJson(ASKED_KEY.queue, true);
    void writeJson(ASKED_KEY.match, true);
    setAsking(false);
    setDue(false);
  }

  return (
    <Sheet visible={due && active} onClose={done} locked={asking}>
      <View style={styles.words}>
        <ThemedText type="title" accessibilityRole="header">
          {moment === 'queue' ? t('home.pushQueueTitle') : t('home.pushMatchTitle', { name: name ?? '' })}
        </ThemedText>
        <ThemedText type="body">
          {moment === 'queue' ? t('home.pushQueueBody') : t('home.pushMatchBody', { name: name ?? '' })}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Button title={t('home.pushYes')} loading={asking} onPress={() => void yes()} />
        <Button
          title={t('common.notNow')}
          variant="plain"
          disabled={asking}
          onPress={() => {
            haptics.selection();
            done();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  words: {
    gap: Space.xs,
    marginTop: Space.xs,
  },
  actions: {
    gap: 6,
  },
});
