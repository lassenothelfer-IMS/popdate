import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { MinTouch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** The shared Icon set has no gear, so this one draws its own symbol. */
const GEAR = { ios: 'gearshape', android: 'settings', web: 'settings' } as const;

/**
 * `settings/index.tsx` serves `/settings`. Cast because the generated route
 * types sometimes list the index route as `/settings/index` instead.
 */
const SETTINGS = '/settings' as Href;

/**
 * The gear across from the wordmark: opens Settings. An icon-only text action,
 * so it dims while pressed instead of scaling.
 */
export function SettingsButton() {
  const theme = useTheme();
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.settings')}
      onPress={() => router.push(SETTINGS)}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={GEAR}
        size={22}
        tintColor={theme.text}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
    // Lines the glyph's right edge up with the gutter, like the wordmark's left.
    marginRight: -11,
  },
  pressed: {
    opacity: 0.6,
  },
});
