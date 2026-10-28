import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ReportReason } from '@/api';
import { Button } from '@/components/button';
import { CheckMark } from '@/components/option-row';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** The reasons in the order the sheet lists them (R01 in the handoff). */
export const REPORT_REASONS: { reason: ReportReason; key: string }[] = [
  { reason: 'fake', key: 'chat.reasonFake' },
  { reason: 'harassment', key: 'chat.reasonHarassment' },
  { reason: 'inappropriate', key: 'chat.reasonInappropriate' },
  { reason: 'underage', key: 'chat.reasonUnderage' },
  { reason: 'other', key: 'chat.reasonOther' },
];

type ReportSheetProps = {
  visible: boolean;
  name: string;
  /** While the report is being sent: the buttons wait. */
  sending: boolean;
  onCancel: () => void;
  /** The reason, anything you added, and whether to block them too. */
  onReport: (reason: ReportReason, details: string, alsoBlock: boolean) => void;
};

/**
 * Report someone: a title, why it matters, one reason picked from a short list
 * of radio rows, an optional line about what happened, whether to block them
 * too, then Cancel or Report side by side.
 */
export function ReportSheet({ visible, name, sending, onCancel, onReport }: ReportSheetProps) {
  const t = useT();
  const theme = useTheme();
  const [picked, setPicked] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  function close() {
    if (sending) return;
    setPicked(null);
    setDetails('');
    onCancel();
  }

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={styles.header}>
        <ThemedText type="questionSmall" accessibilityRole="header" style={styles.title}>
          {t('chat.reportSheetTitle', { name })}
        </ThemedText>
        <ThemedText type="callout" themeColor="textSecondary">
          {t('chat.reportSheetBody', { name })}
        </ThemedText>
      </View>
      <View accessibilityRole="radiogroup">
        {REPORT_REASONS.map(({ reason, key }, index) => {
          const selected = picked === reason;
          return (
            <Pressable
              key={reason}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={t(key)}
              onPress={() => {
                haptics.selection();
                setPicked(reason);
              }}
              style={({ pressed }) => [
                styles.reason,
                index < REPORT_REASONS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.reasonLabel}>{t(key)}</ThemedText>
              <View
                style={[
                  styles.radio,
                  selected
                    ? { backgroundColor: theme.inverse }
                    : { boxShadow: `inset 0 0 0 1.5px ${theme.borderStrong}` },
                ]}>
                {selected ? <Icon name="check" size={11} color={theme.onInverse} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={t('chat.reportDetails')}
        value={details}
        onChangeText={setDetails}
        placeholder={t('chat.reportDetailsPlaceholder')}
        maxLength={300}
        multiline
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: alsoBlock }}
        aria-checked={alsoBlock}
        accessibilityLabel={t('chat.alsoBlock', { name })}
        onPress={() => {
          haptics.selection();
          setAlsoBlock((on) => !on);
        }}
        style={({ pressed }) => [styles.alsoBlock, pressed && styles.pressed]}>
        <CheckMark checked={alsoBlock} shape="checkbox" />
        <ThemedText style={styles.reasonLabel}>{t('chat.alsoBlock', { name })}</ThemedText>
      </Pressable>
      <View style={styles.actions}>
        <View style={styles.cancel}>
          <Button title={t('common.cancel')} variant="secondary" disabled={sending} onPress={close} />
        </View>
        <View style={styles.report}>
          <Button
            title={t('chat.reportSend')}
            disabled={picked === null}
            loading={sending}
            onPress={() => {
              if (picked) onReport(picked, details.trim(), alsoBlock);
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
    marginTop: Space.xs,
  },
  title: {
    letterSpacing: -0.39,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    minHeight: 52,
  },
  reasonLabel: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.6,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alsoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 44,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Space.xxs,
  },
  cancel: {
    flex: 1,
  },
  report: {
    flex: 1.4,
  },
});
