import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/hooks/use-theme';

/** A quick load shows nothing instead of a spinner that blinks. */
const SPINNER_DELAY_MS = 400;

/** A whole screen still loading its data. The spinner only appears if it takes a while. */
export function LoadingScreen({ label }: { label: string }) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), SPINNER_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <Screen contentStyle={styles.center}>
      {visible ? <ActivityIndicator color={theme.textSecondary} accessibilityLabel={label} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
