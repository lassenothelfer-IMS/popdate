import { NativeTabs } from 'expo-router/native-tabs';

import { useYourTurnCount } from '@/features/matches/use-your-turn';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Home, Matches and Settings as the system tab bar: labels, the iOS 26 glass
 * bar, and screens that keep their state when you switch. Matches wears a badge
 * while a chat is waiting on you.
 */
export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const yourTurn = useYourTurnCount();
  return (
    <NativeTabs tintColor={theme.accent} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf="house" md="home" />
        <NativeTabs.Trigger.Label>{t('home.tabHome')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="chat" />
        <NativeTabs.Trigger.Label>{t('home.tabMatches')}</NativeTabs.Trigger.Label>
        {yourTurn > 0 ? <NativeTabs.Trigger.Badge>{String(yourTurn)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>{t('home.settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
