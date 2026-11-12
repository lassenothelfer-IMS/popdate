import { StyleSheet, View } from 'react-native';

import { Balloon } from '@/components/balloon';
import { ThemedText } from '@/components/themed-text';
import { BrandBalloon, Space } from '@/constants/theme';
import { refillTime, type BalloonState } from '@/features/balloons/use-balloons';
import { useLocale, useT } from '@/i18n';

/** "3 balloons left", "Unlimited balloons with Popdate+", or when the free ones come back. */
export function BalloonLine({ balloons }: { balloons: BalloonState }) {
  const t = useT();
  const locale = useLocale();
  const { count, refillsAt } = balloons;
  if (count === undefined) return null;

  const text =
    count === null
      ? t('balloons.unlimited')
      : count === 0
        ? t('balloons.empty', { time: refillsAt ? refillTime(refillsAt, locale) : '0:00' })
        : t('balloons.count', { count });

  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      <Balloon color={BrandBalloon.color} size={14} shine={false} />
      <ThemedText type="callout" style={styles.text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  text: {
    flexShrink: 1,
  },
});
