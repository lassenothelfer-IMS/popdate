import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { MinTouch, Space } from '@/constants/theme';
import { useT } from '@/i18n';

/**
 * A chevron and "Back", like the system back button. It's a text action, so it
 * dims while pressed instead of scaling.
 */
export function BackButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={onPress}
      hitSlop={{ left: Space.sm, right: Space.sm }}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name="back" size={17} />
      <ThemedText type="label">{t('common.back')}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: MinTouch,
    paddingRight: 6,
    // The chevron's artwork has side bearing; this lines its stroke up with the text below.
    marginLeft: -6,
  },
  pressed: {
    opacity: 0.6,
  },
});
