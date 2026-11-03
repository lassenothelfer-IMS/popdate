import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { api, type ReportReason } from '@/api';
import { MinTouch } from '@/constants/theme';
import { acknowledge, confirmStep, useChoice } from '@/features/chat/prompts';
import { ReportSheet } from '@/features/chat/report-sheet';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** Someone you can report or block, and unmatch when you're matched. */
export type Person = { id: string; name: string; age?: number; matchId?: string };

/** A choice of the screen's own, listed above Report, Block and Unmatch. */
export type Extra = { label: string; onPress: () => void };

type Options = {
  /** They're blocked or unmatched: leave whatever screen showed them. */
  onGone?: (person: Person) => void;
};

/**
 * Report, Block and (for a match) Unmatch, the same everywhere someone appears:
 * the room, the match, the recap, your matches and chat. `open` asks what to
 * do; render `element` once anywhere in the screen.
 */
export function usePersonActions({ onGone }: Options = {}): {
  /** `extras` come first in the list, like the chat's Safety check-in. */
  open: (person: Person, extras?: Extra[]) => Promise<void>;
  /** For a screen with several people, like the room: asks who first. */
  openAmong: (people: Person[]) => Promise<void>;
  element: ReactNode;
  busy: boolean;
} {
  const t = useT();
  const { choose, sheet } = useChoice();
  const [reporting, setReporting] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(person: Person, extras: Extra[] = []) {
    if (busy) return;
    const choices = [
      ...extras.map((extra) => ({ label: extra.label })),
      { label: t('chat.report') },
      { label: t('chat.block'), destructive: true },
    ];
    if (person.matchId) choices.push({ label: t('chat.unmatch'), destructive: true });
    const picked = await choose({
      title: person.age ? t('common.nameAge', { name: person.name, age: person.age }) : person.name,
      choices,
    });
    if (picked === null) return;
    if (picked < extras.length) {
      extras[picked].onPress();
      return;
    }
    const action = picked - extras.length;
    if (action === 0) setReporting(person);
    if (action === 1) await block(person);
    if (action === 2) await unmatch(person);
  }

  async function openAmong(people: Person[]) {
    if (busy || people.length === 0) return;
    if (people.length === 1) return open(people[0]);
    const picked = await choose({
      title: t('chat.whoTitle'),
      choices: people.map((person) => ({ label: person.name })),
    });
    if (picked === null) return;
    // Let the first action sheet finish closing before the next one opens.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await open(people[picked]);
  }

  async function report(reason: ReportReason, details: string, alsoBlock: boolean) {
    const person = reporting;
    if (!person) return;
    setBusy(true);
    try {
      await api.report(person.id, reason, details || undefined);
      if (alsoBlock) await api.block(person.id);
      haptics.success();
      setReporting(null);
      acknowledge(t('chat.reported'));
      if (alsoBlock) onGone?.(person);
    } catch {
      setReporting(null);
      haptics.error();
      acknowledge(t('chat.reportFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function block(person: Person) {
    const confirmed = await confirmStep({
      title: t('chat.blockTitle', { name: person.name }),
      message: t('chat.blockMessage', { name: person.name }),
      confirmLabel: t('chat.block'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.block(person.id);
      haptics.medium();
      onGone?.(person);
    } catch {
      haptics.error();
      acknowledge(t('chat.blockFailed', { name: person.name }));
    } finally {
      setBusy(false);
    }
  }

  async function unmatch(person: Person) {
    if (!person.matchId) return;
    const confirmed = await confirmStep({
      title: t('chat.unmatchTitle', { name: person.name }),
      message: t('chat.unmatchMessage', { name: person.name }),
      confirmLabel: t('chat.unmatch'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.unmatch(person.matchId);
      haptics.medium();
      onGone?.(person);
    } catch {
      haptics.error();
      acknowledge(t('chat.unmatchFailed', { name: person.name }));
    } finally {
      setBusy(false);
    }
  }

  const element = (
    <>
      {sheet}
      <ReportSheet
        visible={reporting !== null}
        name={reporting?.name ?? ''}
        sending={busy}
        onCancel={() => setReporting(null)}
        onReport={(reason, details, alsoBlock) => void report(reason, details, alsoBlock)}
      />
    </>
  );

  return { open, openAmong, element, busy };
}

type MoreButtonProps = {
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** The ellipsis in a header's corner that opens Report, Block and Unmatch. */
export function MoreButton({ label, hint, disabled = false, onPress, style }: MoreButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={({ pressed }) => [styles.more, (pressed || disabled) && styles.pressed, style]}>
      <SymbolView
        name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
        size={20}
        tintColor={theme.text}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  more: {
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
