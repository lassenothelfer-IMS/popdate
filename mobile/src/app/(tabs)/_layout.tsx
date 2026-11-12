import { NativeTabs } from 'expo-router/native-tabs';

import { useYourTurnCount } from '@/features/matches/use-your-turn';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * Play, Rooms, Matches and You on the system's own tab bar: Liquid Glass on
 * iOS 26 and later, the classic bar before that, Material on Android. The
 * system draws it, so it gets the glass, the selection capsule and the drag
 * along the bar for free. Each tab is its own route and renders its own screen.
 */
export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const yourTurn = useYourTurnCount();
  return (
    <NativeTabs tintColor={theme.text}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'balloon', selected: 'balloon.fill' }} md="circle" />
        <NativeTabs.Trigger.Label>{t('home.tabHome')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rooms">
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
        <NativeTabs.Trigger.Label>{t('home.tabRooms')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} md="chat_bubble" />
        <NativeTabs.Trigger.Label>{t('home.tabMatches')}</NativeTabs.Trigger.Label>
        {/* Chats waiting on you, as the system's own badge. */}
        {yourTurn > 0 ? <NativeTabs.Trigger.Badge>{String(yourTurn)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>{t('home.tabYou')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
