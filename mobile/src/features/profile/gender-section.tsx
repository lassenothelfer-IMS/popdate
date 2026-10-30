import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Gender, Interest } from '@/api';
import { Chip } from '@/components/chip';
import { OptionRow } from '@/components/option-row';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import {
  IDENTITIES,
  MAIN_IDENTITIES,
  SEXUALITIES,
  identityLabel,
  sexualityLabel,
  sideOf,
  type Identity,
} from '@/features/profile/identity';
import type { ProfileForm } from '@/features/profile/profile-form';
import { useT } from '@/i18n';

/** What you picked for your gender, and the side of the room it plays on. */
export type IdentityChoice = { identity: Identity | null; side: Gender | null };

/** The side the room uses: fixed by the identity, or the one you chose for it. */
export function resolvedSide({ identity, side }: IdentityChoice): Gender | null {
  if (!identity) return null;
  return sideOf(identity) ?? side;
}

type IdentityPickerProps = {
  value: IdentityChoice;
  onChange: (next: IdentityChoice) => void;
  /** Names the radio group for VoiceOver, like the step's title. */
  label: string;
};

/**
 * Woman, man and non-binary as rows, then more genders as chips. An identity
 * that doesn't settle the side of the room asks for one below it.
 */
export function IdentityPicker({ value, onChange, label }: IdentityPickerProps) {
  const t = useT();
  const main = IDENTITIES.slice(0, MAIN_IDENTITIES);
  const more = IDENTITIES.slice(MAIN_IDENTITIES);
  const asksSide = value.identity !== null && sideOf(value.identity) === null;

  function pick(identity: Identity) {
    onChange({ identity, side: value.side });
  }

  return (
    <View style={styles.picker}>
      <View style={styles.rows} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {main.map((identity) => (
          <OptionRow
            key={identity}
            label={identityLabel(t, identity)}
            selected={value.identity === identity}
            onPress={() => pick(identity)}
          />
        ))}
      </View>
      <View style={styles.more}>
        <ThemedText type="kicker">{t('profile.moreGenders')}</ThemedText>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('profile.moreGenders')}>
          {more.map((identity) => (
            <Chip
              key={identity}
              label={identityLabel(t, identity)}
              selected={value.identity === identity}
              onPress={() => pick(identity)}
            />
          ))}
        </View>
      </View>
      {asksSide && value.identity ? (
        <View style={styles.side}>
          <ThemedText type="headline">{t('profile.sideTitle')}</ThemedText>
          <ThemedText type="callout" themeColor="textSecondary">
            {t('profile.sideBody', { identity: identityLabel(t, value.identity) })}
          </ThemedText>
          <View style={styles.rows} accessibilityRole="radiogroup" accessibilityLabel={t('profile.sideTitle')}>
            <OptionRow
              label={t('profile.sideWomen')}
              selected={value.side === 'woman'}
              onPress={() => onChange({ ...value, side: 'woman' })}
            />
            <OptionRow
              label={t('profile.sideMen')}
              selected={value.side === 'man'}
              onPress={() => onChange({ ...value, side: 'man' })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

type MeetPickerProps = {
  value: Interest | null;
  onChange: (next: Interest) => void;
  /** Names the radio group for VoiceOver, like the step's title. */
  label: string;
};

/** Women, men or everyone: who you want to meet, which decides the rooms you walk into. */
export function MeetPicker({ value, onChange, label }: MeetPickerProps) {
  const t = useT();
  return (
    <View style={styles.rows} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <OptionRow label={t('onboarding.women')} selected={value === 'woman'} onPress={() => onChange('woman')} />
      <OptionRow label={t('onboarding.men')} selected={value === 'man'} onPress={() => onChange('man')} />
      <OptionRow
        label={t('onboarding.everyone')}
        selected={value === 'everyone'}
        onPress={() => onChange('everyone')}
      />
    </View>
  );
}

type GenderSectionProps = {
  form: ProfileForm;
  /** Editing a profile: your gender can change here too. Setup asked it in onboarding. */
  identity?: { value: IdentityChoice; onChange: (next: IdentityChoice) => void };
  style?: StyleProp<ViewStyle>;
};

/**
 * "Gender and sexuality" on your profile: your gender in your own words, like
 * pronouns, and your sexuality. Both are optional; tap a picked chip to clear it.
 */
export function GenderSection({ form, identity, style }: GenderSectionProps) {
  const t = useT();
  return (
    <Section title={t('profile.genderAndSexuality')} style={[styles.section, style]}>
      {identity ? (
        <IdentityPicker value={identity.value} onChange={identity.onChange} label={t('profile.gender')} />
      ) : null}
      <TextField
        label={t('profile.genderDetails')}
        value={form.genderDetails}
        onChangeText={form.setGenderDetails}
        maxLength={40}
        placeholder={t('profile.genderDetailsPlaceholder')}
        autoCapitalize="none"
      />
      <View style={styles.more}>
        <ThemedText type="kicker">{t('profile.sexuality')}</ThemedText>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('profile.sexuality')}>
          {SEXUALITIES.map((sexuality) => (
            <Chip
              key={sexuality}
              label={sexualityLabel(t, sexuality)}
              selected={form.sexuality === sexuality}
              onPress={() => form.setSexuality(form.sexuality === sexuality ? null : sexuality)}
            />
          ))}
        </View>
      </View>
      <ThemedText type="footnote" themeColor="textTertiary">
        {t('profile.genderShown')}
      </ThemedText>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  picker: {
    gap: Space.lg,
  },
  rows: {
    gap: 10,
  },
  more: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  side: {
    gap: 10,
  },
});
