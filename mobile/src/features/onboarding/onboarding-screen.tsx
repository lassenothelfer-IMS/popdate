import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { Interest } from '@/api';
import { Button } from '@/components/button';
import { ErrorIcon, errorEnter } from '@/components/error-line';
import { CheckMark, OptionRow } from '@/components/option-row';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ProgressSegments } from '@/components/progress-segments';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { VideoBackground } from '@/components/video-background';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Colors, Fonts, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { INTRO } from '@/features/how-to-play/step-art';
import { BackButton } from '@/features/onboarding/back-button';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import { IdentityPicker, resolvedSide, type IdentityChoice } from '@/features/profile/gender-section';
import { testProfileDetails } from '@/features/profile/test-profile';
import { ForcedScheme, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { ageFromBirthDate, parseBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';

/**
 * The welcome, the three "How it works" cards, then one question per screen
 * (design S01 to S04, S07 to S10 and S17). The profile follows on its own route.
 */
const STEPS = ['welcome', 'rooms', 'rounds', 'last', 'birthday', 'gender', 'meet', 'rules'] as const;
type Step = (typeof STEPS)[number];
type Intro = 'rooms' | 'rounds' | 'last';
type Question = 'birthday' | 'gender' | 'meet' | 'rules';

const INTROS: Intro[] = ['rooms', 'rounds', 'last'];
const QUESTIONS: Question[] = ['birthday', 'gender', 'meet', 'rules'];

/** Translation keys of each question's title and the line under it. */
const TITLES: Record<Question, string> = {
  birthday: 'onboarding.titleBirthday',
  gender: 'onboarding.titleGender',
  meet: 'onboarding.titleMeet',
  rules: 'onboarding.titleTerms',
};
const SUBTITLES: Record<Question, string> = {
  birthday: 'onboarding.subtitleBirthday',
  gender: 'onboarding.subtitleGender',
  meet: 'onboarding.subtitleMeet',
  rules: 'onboarding.subtitleRules',
};

/** Read by VoiceOver on Continue while the step isn't answered yet (translation keys). */
const CONTINUE_HINTS: Record<Question, string> = {
  birthday: 'onboarding.hintBirthday',
  gender: 'onboarding.hintChoose',
  meet: 'onboarding.hintChoose',
  rules: 'onboarding.hintTerms',
};

/** The four house rules: a title and a line each (translation keys). */
const RULES = [1, 2, 3, 4].map((n) => ({
  title: `onboarding.rule${n}Title`,
  body: `onboarding.rule${n}Body`,
}));

/** The birthday as typed: day, month and year, digits only. */
type BirthEntry = { day: string; month: string; year: string };

function digitsOnly(text: string) {
  return text.replace(/\D/g, '');
}

/**
 * Nothing until the year has four digits, then a valid adult birthday or the
 * translation key of what is wrong with it.
 */
function checkBirthday({ day, month, year }: BirthEntry):
  | { pending: true }
  | { birthDate: string; age: number }
  | { error: string } {
  if (!day || !month || year.length < 4) return { pending: true };
  const birthDate = parseBirthDate(day, month, year);
  if (!birthDate) return { error: 'onboarding.birthdayInvalid' };
  const age = ageFromBirthDate(birthDate);
  if (age < 18) return { error: 'onboarding.birthdayTooYoung' };
  return { birthDate, age };
}

export function OnboardingScreen() {
  const { setOnboarding, saveProfile } = useSession();
  const theme = useTheme();
  const t = useT();
  const [step, setStep] = useState<Step>('welcome');
  // The step you came from: the screen entrance only plays on a change.
  const [from, setFrom] = useState<Step | null>(null);
  const headingRef = useRef<ViewInstance>(null);
  const [birth, setBirth] = useState<BirthEntry>({ day: '', month: '', year: '' });
  const [identity, setIdentity] = useState<IdentityChoice>({ identity: null, side: null });
  const gender = resolvedSide(identity);
  const [wantsToMeet, setWantsToMeet] = useState<Interest | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const birthCheck = checkBirthday(birth);
  const birthdayError = 'error' in birthCheck ? t(birthCheck.error) : null;

  function goTo(next: Step) {
    setFrom(step);
    setStep(next);
  }

  // Android's back button walks back through the steps before it leaves onboarding.
  useEffect(() => {
    if (step === 'welcome') return;
    const previous = STEPS[STEPS.indexOf(step) - 1];
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setFrom(step);
      setStep(previous);
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  // Steps change inside one route, so the system posts no screen change.
  // Move VoiceOver and TalkBack to the new heading once it has risen in.
  useEffect(() => {
    if (from === null || Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (headingRef.current) AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus');
    }, Motion.enter);
    return () => clearTimeout(timer);
  }, [step, from]);

  // Say a new birthday error once, after the key echo. The live region speaks it elsewhere.
  useEffect(() => {
    if (birthdayError && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(birthdayError, { queue: true });
    }
  }, [birthdayError]);

  function handleContinue() {
    haptics.light();
    if (step === 'birthday') {
      if (!('birthDate' in birthCheck)) return;
      goTo('gender');
    } else if (step === 'gender') {
      goTo('meet');
    } else if (step === 'meet') {
      goTo('rules');
    } else {
      finish();
    }
  }

  function finish() {
    if (!('birthDate' in birthCheck)) {
      goTo('birthday');
      return;
    }
    if (!gender || !wantsToMeet) return;
    setOnboarding({
      birthDate: birthCheck.birthDate,
      gender,
      wantsToMeet,
      genderIdentity: identity.identity ?? undefined,
      termsAcceptedAt: new Date().toISOString(),
    });
    router.replace('/profile-setup');
  }

  async function handleTestProfile() {
    const answers = {
      birthDate: '2000-05-17',
      gender: 'woman' as const,
      wantsToMeet: 'man' as const,
      genderIdentity: 'woman',
      termsAcceptedAt: new Date().toISOString(),
    };
    setOnboarding(answers);
    await saveProfile(testProfileDetails(), answers);
    router.replace('/home');
  }

  function toggleTerms() {
    haptics.selection();
    setTermsAccepted((accepted) => !accepted);
  }

  if (step === 'welcome') {
    // Always the dark treatment: light text over the video, whatever the Appearance setting.
    return (
      <ForcedScheme value="dark">
      <StatusBar style="light" />
      <Screen
        key="welcome"
        footerStyle="plain"
        contentStyle={styles.welcomeContent}
        background={<VideoBackground video={WELCOME_VIDEO} poster={WELCOME_POSTER} tint={Colors.dark.page} />}
        footer={
          <Rise index={3} style={styles.welcomeActions}>
            <Button
              title={t('onboarding.getStarted')}
              onPress={() => {
                haptics.light();
                goTo('rooms');
              }}
            />
            {__DEV__ ? (
              <Button title={t('onboarding.skipTest')} variant="plain" onPress={handleTestProfile} />
            ) : null}
          </Rise>
        }>
        <Rise index={0}>
          <View style={styles.logoShadow}>
            <Wordmark />
          </View>
        </Rise>
        <View style={styles.welcomeStage}>
          <Rise index={1} style={styles.welcomeHero}>
            <View
              ref={headingRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel={t('onboarding.heroLabel')}>
              <ThemedText type="hero" maxFontSizeMultiplier={1.4} style={[styles.heroLine, styles.onVideo]}>
                {t('onboarding.hero')}
              </ThemedText>
            </View>
          </Rise>
          <Rise index={2}>
            <ThemedText themeColor="textSecondary" style={[styles.welcomeBody, styles.onVideo]}>
              {t('onboarding.welcomeBody')}
            </ThemedText>
          </Rise>
        </View>
      </Screen>
      </ForcedScheme>
    );
  }

  if (INTROS.includes(step as Intro)) {
    const index = INTROS.indexOf(step as Intro);
    const { Art, title, body } = INTRO[index];
    const last = index === INTROS.length - 1;
    return (
      <Screen
        key={step}
        scroll
        footerStyle="plain"
        footer={
          <Button
            title={last ? t('onboarding.gotIt') : t('onboarding.next')}
            onPress={() => {
              haptics.light();
              goTo(last ? 'birthday' : INTROS[index + 1]);
            }}
          />
        }>
        <Rise index={0} style={styles.introTop}>
          <PageDots
            count={INTROS.length}
            active={index}
            label={t('onboarding.introPage', { page: index + 1, total: INTROS.length })}
          />
          <Button
            title={t('onboarding.skip')}
            variant="plain"
            fullWidth={false}
            onPress={() => goTo('birthday')}
          />
        </Rise>
        <Rise index={1} style={styles.introArt}>
          <Art />
        </Rise>
        <Rise index={2} style={styles.introText}>
          <View ref={headingRef} accessible accessibilityRole="header">
            <ThemedText type="display">{t(title)}</ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.introBody}>
            {t(body)}
          </ThemedText>
        </Rise>
      </Screen>
    );
  }

  const question = step as Question;
  const number = QUESTIONS.indexOf(question) + 1;
  const canContinue =
    question === 'birthday'
      ? 'birthDate' in birthCheck
      : question === 'gender'
        ? gender !== null
        : question === 'meet'
          ? wantsToMeet !== null
          : termsAccepted;
  const stepLabel = setupStepLabel(number, t);
  const title = t(TITLES[question]);
  const previous = STEPS[STEPS.indexOf(question) - 1];

  return (
    <Screen
      key={question}
      scroll
      footerStyle="plain"
      footer={
        <Button
          title={question === 'rules' ? t('onboarding.agree') : t('common.continue')}
          disabled={!canContinue}
          onPress={handleContinue}
          accessibilityHint={canContinue ? undefined : t(CONTINUE_HINTS[question])}
        />
      }>
      {/* The bar and Back stay put from question to question: they only rise in from the intro. */}
      <Rise index={0}>
        <View style={styles.progress}>
          <ProgressSegments total={SETUP_STEPS} filled={number} gap={4} accessibilityLabel={stepLabel} />
        </View>
        <BackButton onPress={() => goTo(previous)} />
      </Rise>

      <Rise index={1} style={styles.heading}>
        <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${stepLabel}`}>
          <ThemedText type="display">{title}</ThemedText>
        </View>
        <ThemedText type="callout" themeColor="textSecondary">
          {t(SUBTITLES[question])}
        </ThemedText>
      </Rise>

      <Rise index={2} style={styles.answer}>
        {question === 'birthday' ? (
          <Birthday birth={birth} onChange={setBirth} check={birthCheck} error={birthdayError} />
        ) : null}

        {question === 'gender' ? <IdentityPicker value={identity} onChange={setIdentity} label={title} /> : null}

        {question === 'meet' ? (
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={title}>
            <OptionRow
              label={t('onboarding.women')}
              selected={wantsToMeet === 'woman'}
              onPress={() => setWantsToMeet('woman')}
            />
            <OptionRow
              label={t('onboarding.men')}
              selected={wantsToMeet === 'man'}
              onPress={() => setWantsToMeet('man')}
            />
            <OptionRow
              label={t('onboarding.everyone')}
              selected={wantsToMeet === 'everyone'}
              onPress={() => setWantsToMeet('everyone')}
            />
          </View>
        ) : null}

        {question === 'rules' ? (
          <View style={styles.rulesAnswer}>
            <View>
              {RULES.map((rule, i) => (
                <View
                  key={rule.title}
                  accessible
                  style={[
                    styles.rule,
                    i < RULES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                  ]}>
                  <Text style={[styles.ruleNumber, { color: theme.accent }]}>{i + 1}</Text>
                  <View style={styles.ruleText}>
                    <ThemedText type="task">{t(rule.title)}</ThemedText>
                    <ThemedText type="callout" themeColor="textSecondary" style={styles.ruleBody}>
                      {t(rule.body)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
            {/* The whole box is the checkbox; the links inside are read as part of its label. */}
            <PressableHighlight
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              aria-checked={termsAccepted}
              accessibilityLabel={t('onboarding.termsLabel')}
              onPress={toggleTerms}
              background={theme.field}
              style={[styles.terms, { borderColor: theme.border }]}>
              <CheckMark checked={termsAccepted} shape="checkbox" />
              {/* Each link opens its page; a tap anywhere else toggles the box. */}
              <ThemedText type="callout" style={[styles.flex, styles.termsText]}>
                {t('onboarding.termsBefore')}
                <ThemedText
                  accessibilityRole="link"
                  style={styles.link}
                  onPress={() => router.push('/settings/terms' as Href)}>
                  {t('onboarding.terms')}
                </ThemedText>
                {t('onboarding.termsAnd')}
                <ThemedText
                  accessibilityRole="link"
                  style={styles.link}
                  onPress={() => router.push('/settings/privacy' as Href)}>
                  {t('onboarding.privacy')}
                </ThemedText>
                {t('onboarding.termsAfter')}
              </ThemedText>
            </PressableHighlight>
            {__DEV__ ? (
              <ThemedText type="footnote" themeColor="textTertiary">
                {t('onboarding.testAccount')}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </Rise>
    </Screen>
  );
}

/** The welcome's looping background and its first frame (see VideoBackground). */
const WELCOME_VIDEO = require('../../../assets/video/popdate_welcome_loop.mp4');
const WELCOME_POSTER = require('../../../assets/images/popdate_welcome_poster.jpg');

/** AutoFill hints for the three birthday fields. */
const CONTENT_TYPES = { day: 'birthdateDay', month: 'birthdateMonth', year: 'birthdateYear' } as const;
const AUTOCOMPLETE = { day: 'birthdate-day', month: 'birthdate-month', year: 'birthdate-year' } as const;

/** Three dots over the intro cards, the current one a 20 pt bar. */
function PageDots({ count, active, label }: { count: number; active: number; label: string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active && styles.dotActive,
            { backgroundColor: i === active ? theme.accent : theme.track },
          ]}
        />
      ))}
    </View>
  );
}

type BirthdayProps = {
  birth: BirthEntry;
  onChange: (next: BirthEntry) => void;
  check: ReturnType<typeof checkBirthday>;
  error: string | null;
};

/**
 * Day, month and year in three fields, then the age the room will see, or what is
 * wrong. A full field hands the cursor on to the next one, and deleting past the
 * start of a field goes back to the one before.
 */
function Birthday({ birth, onChange, check, error }: BirthdayProps) {
  const t = useT();
  const theme = useTheme();
  const dayRef = useRef<TextInputInstance>(null);
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);
  const parts = [
    {
      key: 'day',
      label: t('onboarding.day'),
      max: 2,
      placeholder: t('onboarding.dayPlaceholder'),
      ref: dayRef,
      previous: null,
    },
    {
      key: 'month',
      label: t('onboarding.month'),
      max: 2,
      placeholder: t('onboarding.monthPlaceholder'),
      ref: monthRef,
      previous: dayRef,
    },
    {
      key: 'year',
      label: t('onboarding.year'),
      max: 4,
      placeholder: t('onboarding.yearPlaceholder'),
      ref: yearRef,
      previous: monthRef,
    },
  ] as const;

  /**
   * Digits typed into one field fill it, and any it can't hold run on into the
   * next ones, so typing fast or pasting a whole date lands in the right places.
   * The cursor follows to the next field once one is full.
   */
  function change(index: number, text: string) {
    const next = { ...birth };
    let rest = digitsOnly(text);
    let landed = index;
    for (let i = index; i < parts.length; i++) {
      const { key, max } = parts[i];
      let value = rest.slice(0, max);
      rest = rest.slice(max);
      // No day starts with 4 to 9 and no month with 2 to 9: that digit is the whole number.
      const first = Number(value);
      if (value.length === 1 && ((key === 'day' && first > 3) || (key === 'month' && first > 1))) {
        value = `0${value}`;
      }
      next[key] = value;
      landed = i;
      if (!rest) break;
    }
    onChange(next);
    const { key, max } = parts[landed];
    const filled = next[key].length === max && (landed > index || next[key].length > birth[key].length);
    const focus = filled && landed < parts.length - 1 ? landed + 1 : landed;
    if (focus !== index) parts[focus].ref.current?.focus();
  }

  return (
    <View style={styles.birthday}>
      <View style={styles.birthRow}>
        {parts.map((part, index) => (
          <View key={part.key} style={styles.flex}>
            <TextField
              ref={part.ref}
              label={part.label}
              value={birth[part.key]}
              onChangeText={(text) => change(index, text)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && birth[part.key] === '') part.previous?.current?.focus();
              }}
              autoFocus={part.key === 'day' && birth.day === ''}
              textContentType={CONTENT_TYPES[part.key]}
              autoComplete={AUTOCOMPLETE[part.key]}
              keyboardType="number-pad"
              placeholder={part.placeholder}
              error={error !== null}
              accessibilityHint={error ?? undefined}
              style={styles.birthInput}
            />
          </View>
        ))}
      </View>
      <View accessibilityLiveRegion="polite">
        {error ? (
          <Animated.View key="error" entering={errorEnter} style={styles.error}>
            <ErrorIcon />
            <ThemedText type="footnote" themeColor="danger" style={styles.flex}>
              {error}
            </ThemedText>
          </Animated.View>
        ) : 'age' in check ? (
          <View style={[styles.ageCard, { backgroundColor: theme.field, borderColor: theme.border }]}>
            <Text style={[styles.age, { color: theme.text }]}>{check.age}</Text>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.flex}>
              {t('onboarding.ageSeen')}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContent: {
    flexGrow: 1,
    paddingTop: 10,
  },
  // The line and copy sit low; the balloon floats above them in the space left.
  welcomeStage: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Space.lg,
    gap: 20,
  },
  welcomeHero: {
    zIndex: 1,
  },
  heroLine: {
    maxWidth: 260,
  },
  // A soft shadow lifts the logo and the copy off the video.
  onVideo: {
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  logoShadow: {
    alignSelf: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 1 },
  },
  welcomeBody: {
    lineHeight: 23,
    maxWidth: 330,
  },
  welcomeActions: {
    gap: 6,
  },
  introTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MinTouch,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
  },
  introArt: {
    marginTop: 12,
  },
  introText: {
    marginTop: 40,
    gap: 14,
  },
  introBody: {
    lineHeight: 23,
  },
  progress: {
    paddingTop: Space.xxs,
    paddingBottom: Space.xxs,
  },
  heading: {
    marginTop: 26,
    gap: 10,
  },
  answer: {
    marginTop: Space.lg,
  },
  options: {
    gap: 10,
  },
  birthday: {
    gap: Space.lg,
  },
  birthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  birthInput: {
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.xs,
  },
  ageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  age: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontSize: 28,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  rulesAnswer: {
    gap: Space.lg,
  },
  rule: {
    flexDirection: 'row',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  ruleNumber: {
    width: 28,
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 28,
  },
  ruleText: {
    flex: 1,
    gap: 3,
  },
  ruleBody: {
    fontSize: 14,
    lineHeight: 19,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 19,
  },
  link: {
    textDecorationLine: 'underline',
  },
  flex: {
    flex: 1,
  },
});
