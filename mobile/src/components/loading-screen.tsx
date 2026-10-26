import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Space } from '@/constants/theme';

/** A quick load shows nothing instead of blocks that blink. */
const SKELETON_DELAY_MS = 400;

/** A whole screen still loading its data: skeleton blocks, never a spinner, and only if it takes a while. */
export function LoadingScreen({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <Screen>
      {visible ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.stack}>
          <Skeleton style={styles.header} />
          <Skeleton style={styles.title} />
          <Skeleton style={styles.card} />
          <Skeleton style={styles.row} />
          <Skeleton style={styles.row} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Space.md,
    paddingTop: Space.md,
  },
  header: { height: 18, width: '40%', borderRadius: 9 },
  title: { height: 40, width: '75%' },
  card: { height: 220 },
  row: { height: 56 },
});
