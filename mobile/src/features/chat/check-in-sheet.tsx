import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { acknowledge } from '@/features/chat/prompts';
import { useLocale, useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** When to check in, in hours from now. */
const HOURS = [1, 2, 3, 4] as const;

type CheckInSheetProps = {
  visible: boolean;
  name: string;
  matchId: string;
  onClose: () => void;
};

/**
 * A safety check-in before a date: pick when to be asked "Everything okay?",
 * and tell a friend who you're meeting and when you'll check in. The reminder
 * is a notification on this phone; tapping it opens the chat.
 */
export function CheckInSheet({ visible, name, matchId, onClose }: CheckInSheetProps) {
  const t = useT();
  const locale = useLocale();
  const [hours, setHours] = useState<(typeof HOURS)[number]>(2);
  const [saving, setSaving] = useState(false);

  /** The check-in time for the hours picked, read when you act on it. */
  function checkInTime() {
    const at = new Date(Date.now() + hours * 60 * 60_000);
    return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  async function setReminder() {
    setSaving(true);
    try {
      if (Platform.OS !== 'web') {
        let { status } = await Notifications.getPermissionsAsync();
        if (status === 'undetermined') ({ status } = await Notifications.requestPermissionsAsync());
        if (status !== 'granted') {
          acknowledge(t('checkin.noPermissionTitle'), t('checkin.noPermissionBody'));
          return;
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('checkin.notifyTitle'),
            body: t('checkin.notifyBody', { name }),
            data: { type: 'chat', matchId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: hours * 60 * 60,
          },
        });
      }
      haptics.success();
      acknowledge(t('checkin.setTitle'), t('checkin.setBody', { time: checkInTime() }));
      onClose();
    } catch {
      haptics.error();
      acknowledge(t('checkin.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function tellFriend() {
    try {
      await Share.share({ message: t('checkin.shareMessage', { name, time: checkInTime() }) });
    } catch {
      // Closing the share sheet isn't an error.
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('checkin.title')}>
      <ThemedText type="callout" themeColor="textSecondary">
        {t('checkin.body', { name })}
      </ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('checkin.when')}>
        {HOURS.map((h) => (
          <Chip
            key={h}
            label={t('checkin.inHours', { count: h })}
            selected={hours === h}
            onPress={() => setHours(h)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button title={t('checkin.set')} loading={saving} onPress={() => void setReminder()} />
        <Button title={t('checkin.tellFriend')} variant="tinted" onPress={() => void tellFriend()} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  actions: {
    gap: Space.xs,
  },
});
