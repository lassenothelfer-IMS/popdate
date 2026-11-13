import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import type { ProfileForm } from '@/features/profile/profile-form';
import { useT, type Translate } from '@/i18n';
import {
  INTERESTS,
  LANGUAGES,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  type InterestTag,
  type LanguageTag,
} from '@/shared/profile-tags';

/** How many of each list show before "More". */
const FIRST_INTERESTS = 12;
const FIRST_LANGUAGES = 6;

/** `key('interest', 'boardGames')` is `'profile.interestBoardGames'`, typed so a missing string fails to compile. */
function key<P extends string, V extends string>(prefix: P, value: V) {
  return `profile.${prefix}${value[0].toUpperCase()}${value.slice(1)}` as `profile.${P}${Capitalize<V>}`;
}

export function interestLabel(t: Translate, interest: InterestTag) {
  return t(key('interest', interest));
}

export function languageLabel(t: Translate, language: LanguageTag) {
  return t(key('language', language));
}

/**
 * Interests and languages on your profile: both optional, picked from chips,
 * up to five each. Tap a picked chip to take it off again.
 */
export function TagsSection({ form, style }: { form: ProfileForm; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View style={[styles.section, style]}>
      <TagPicker
        title={t('profile.interests')}
        options={INTERESTS}
        first={FIRST_INTERESTS}
        max={MAX_INTERESTS}
        picked={form.interests}
        label={(interest) => interestLabel(t, interest)}
        onToggle={form.toggleInterest}
      />
      <TagPicker
        title={t('profile.languages')}
        options={LANGUAGES}
        first={FIRST_LANGUAGES}
        max={MAX_LANGUAGES}
        picked={form.languages}
        label={(language) => languageLabel(t, language)}
        onToggle={form.toggleLanguage}
      />
    </View>
  );
}

type TagPickerProps<T extends string> = {
  title: string;
  options: readonly T[];
  /** How many show before "More". */
  first: number;
  max: number;
  picked: readonly T[];
  label: (option: T) => string;
  onToggle: (option: T) => void;
};

function TagPicker<T extends string>({ title, options, first, max, picked, label, onToggle }: TagPickerProps<T>) {
  const t = useT();
  const [all, setAll] = useState(false);
  // What you picked always shows, also from behind "More".
  const shown = all ? options : options.filter((option, i) => i < first || picked.includes(option));
  const full = picked.length >= max;
  return (
    <View style={styles.picker}>
      <View style={styles.titleRow}>
        <ThemedText type="kicker">{t('profile.optionalLabel', { label: title })}</ThemedText>
        {picked.length > 0 ? (
          <ThemedText type="callout" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {t('profile.tagsCount', { count: picked.length, max })}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.chips} accessibilityLabel={title}>
        {shown.map((option) => {
          const selected = picked.includes(option);
          return (
            <Chip
              key={option}
              role="checkbox"
              label={label(option)}
              selected={selected}
              // Five are picked: the rest wait until one is taken off.
              disabled={full && !selected}
              onPress={() => onToggle(option)}
            />
          );
        })}
        {!all && shown.length < options.length ? (
          <Chip role="button" outlined label={t('profile.tagsMore')} selected={false} onPress={() => setAll(true)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.lg,
  },
  picker: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
});
