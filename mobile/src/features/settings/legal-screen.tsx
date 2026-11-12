import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { PageBack } from '@/features/settings/page-back';
import { goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export type LegalDoc = 'terms' | 'privacy';

type Section = { title: string; body: string };

/**
 * The Terms of Use and Privacy Policy, in English for every language until
 * they are reviewed and translated. A draft to have checked before launch.
 * The same text is published as web pages (`site/build.mjs`, GitHub Pages),
 * which the paywalls and the App Store listing link to: change it here only.
 */
const UPDATED = '7 November 2026';

const DOCS: Record<LegalDoc, Section[]> = {
  terms: [
    {
      title: 'Who can use Popdate',
      body: 'You must be 18 or older and allowed to use dating services where you live. One account per person, under your real first name, age and photos of you.',
    },
    {
      title: 'How rooms work',
      body: 'Popdate puts you in rooms with up to five other people. Your photos are shown one per round, and your answers are shown to the room. A match opens a private chat between two people.',
    },
    {
      title: 'Zero tolerance for abuse',
      body: 'No harassment, hate, threats, sexual content, nudity, spam, scams, impersonation or anything involving minors. We remove content and accounts that break these rules, without warning. Objectionable content and abusive users are not tolerated.',
    },
    {
      title: 'Reporting and blocking',
      body: 'You can report or block anyone from the room, the match screen, the recap, your matches and chat. Blocked people are never put in your rooms again and cannot message you. We review reports within 24 hours and act on them, up to removing the account.',
    },
    {
      title: 'Your content',
      body: 'You own the photos, answers and messages you post. You give us permission to store and show them to the people Popdate shows them to, only to run the service. You are responsible for what you post.',
    },
    {
      title: 'Meeting in person',
      body: 'We do not run background checks. Meet in public, tell a friend, and read the safe dating tips in Settings. Popdate is not responsible for how people behave on or off the app.',
    },
    {
      title: 'Balloons and Popdate+',
      body: 'Joining a room needs a balloon. You get free balloons every day, and you can buy balloon packs or Popdate+, which gives unlimited balloons. Payment is handled by Apple through your Apple ID. Balloon packs are one-time purchases and do not expire. Popdate+ is a subscription that renews automatically at the price shown, weekly, every 6 months or yearly, unless you cancel it at least 24 hours before the current period ends. You can manage or cancel it in your App Store account settings, or under Settings, Manage Popdate+. Deleting your account does not cancel it. Refunds are handled by Apple.',
    },
    {
      title: 'Ending your account',
      body: 'You can delete your account at any time in Settings. We may suspend or remove accounts that break these terms.',
    },
    {
      title: 'Contact',
      body: 'Questions about these terms: support@popdate.app.',
    },
  ],
  privacy: [
    {
      title: 'What we collect',
      body: 'Your first name, birthday, gender, who you want to meet, city, height, job, bio, optional gender details and sexuality, your six photos, your answers and messages, your settings, the selfie you send for verification, and a push token for this phone.',
    },
    {
      title: 'Who sees what',
      body: 'People in your room see your first name, age, answers and one more photo each round. Your birthday is never shown, only your age. Your matches see your profile and your chat. Your verification selfie is seen only by our review team.',
    },
    {
      title: 'How we use it',
      body: 'To put you in rooms with the people you want to meet, run the game, deliver messages and notifications, keep people safe (reports, blocks, verification, filtering) and fix problems. We do not sell your data or use it for advertising.',
    },
    {
      title: 'Where it is stored',
      body: 'On our backend provider\'s servers. Your session stays in this phone\'s keychain. Data is sent over encrypted connections.',
    },
    {
      title: 'Purchases',
      body: 'If you buy balloons or Popdate+, Apple handles the payment; we never see your card or payment details. Our purchases provider, RevenueCat, receives the purchase and your Popdate account id so your balloons and Popdate+ reach your account.',
    },
    {
      title: 'How long we keep it',
      body: 'While your account exists. Deleting your account in Settings deletes your profile, photos, answers, matches and messages. Your verification selfie is deleted once it has been reviewed. When a chat ends (an unmatch or a deleted account), its last messages are kept for 30 days so they can still be reported, then deleted. Reports about you, with the messages they concern, may be kept for up to a year to keep others safe. If you have Popdate+, only its end date is kept until it runs out, so a restore can move it to a new account.',
    },
    {
      title: 'Your rights',
      body: 'You can see, correct or delete your data, and ask for a copy. Under Swiss and EU data protection law you can also object to processing or complain to your data protection authority.',
    },
    {
      title: 'Contact',
      body: 'Privacy questions and requests: support@popdate.app.',
    },
  ],
};

/** A plain reading page: the title, when it changed, then short titled sections. */
export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const t = useT();
  const theme = useTheme();
  const sections = DOCS[doc];
  return (
    <Screen scroll>
      <PageBack onPress={() => (router.canGoBack() ? router.back() : goBackOr(SETTINGS_PAGE))} />
      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {doc === 'terms' ? t('settings.terms') : t('settings.privacy')}
      </ThemedText>
      <ThemedText type="footnote" themeColor="textSecondary" style={styles.updated}>
        {t('settings.legalUpdated', { date: UPDATED })}
      </ThemedText>
      <View style={styles.list}>
        {sections.map((section, index) => (
          <View
            key={section.title}
            style={[
              styles.section,
              { borderBottomColor: theme.border },
              index === sections.length - 1 && styles.last,
            ]}>
            <ThemedText type="headline" accessibilityRole="header">
              {section.title}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Space.md,
  },
  updated: {
    marginTop: Space.xs,
  },
  list: {
    marginTop: Space.lg,
  },
  section: {
    gap: 6,
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  last: {
    borderBottomWidth: 0,
  },
});
