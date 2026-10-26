import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import Animated, {
  FadeIn,
  Keyframe,
  ReduceMotion,
} from 'react-native-reanimated';

import type { Gender } from '@/api';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorIcon, errorEnter } from '@/components/error-line';
import { CheckMark, OptionRow } from '@/components/option-row';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ProgressSegments } from '@/components/progress-segments';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Ease, Motion, Radius, Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import { WheelPicker } from '@/features/onboarding/wheel-picker';
import { testProfileDetails } from '@/features/profile/test-profile';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/state/session';
import { ageFromBirthDate, parseBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';
import { webSafeKeyframe } from '@/utils/web-motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const TERMS_LABEL = "I'm 18 or older and agree to the Terms and Privacy Policy.";
const BIRTHDAY_HINT = 'Only your age is shown, never your birthday.';

/** The welcome screen, then one question per screen. */
const STEPS = ['welcome', 'birthday', 'gender', 'meet', 'terms'] as const;
type Step = (typeof STEPS)[number];
type Question = Exclude<Step, 'welcome'>;

const TITLES: Record<Question, string> = {
  birthday: "When's your birthday?",
  gender: "I'm a",
  meet: 'I want to meet',
  terms: 'The fine print',
};

/** Read by VoiceOver on Continue while the step isn't answered yet. */
const CONTINUE_HINTS: Record<Question, string> = {
  birthday: 'You need to be 18 or older to continue.',
  gender: 'Choose one to continue.',
  meet: 'Choose one to continue.',
  terms: 'Check the box to continue.',
};

/** Each new step rises 8pt into place; with Reduce Motion it only fades. */
const stepEnter = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.out },
  }).duration(Motion.enter),
);
const stepEnterReduced = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
/** A hundred years back, up to this year. */
const LAST_YEAR = new Date().getFullYear();
const FIRST_YEAR = LAST_YEAR - 100;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => String(FIRST_YEAR + i));

type BirthParts = { day: number; month: number; year: number };

/** Where the wheels start: 1 January 2000. */
const DEFAULT_BIRTH: BirthParts = { day: 1, month: 1, year: 2000 };

/** `month` counts from 1. */
function daysInMonth(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function checkBirthday({ day, month, year }: BirthParts): { birthDate: string } | { error: string } {
  const birthDate = parseBirthDate(String(day), String(month), String(year));
  if (!birthDate) return { error: "That birthday doesn't exist. Check the day and month." };
  if (ageFromBirthDate(birthDate) < 18) return { error: 'You need to be 18 or older to play Popdate.' };
  return { birthDate };
}

export function OnboardingScreen() {
  const { setOnboarding, saveProfile } = useSession();
  const theme = useTheme();
  const reduced = useReduceMotion();
  const [step, setStep] = useState<Step>('welcome');
  // The step you came from. Motion only explains a change, so the first
  // screen (no step before it) appears without any.
  const [from, setFrom] = useState<Step | null>(null);
  // The current step's heading: the welcome line or the question.
  const headingRef = useRef<ViewInstance>(null);
  const [birth, setBirth] = useState<BirthParts>(DEFAULT_BIRTH);
  const [gender, setGender] = useState<Gender | null>(null);
  const [wantsToMeet, setWantsToMeet] = useState<Gender | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const index = STEPS.indexOf(step);
  const enter = from !== null ? (reduced ? stepEnterReduced : stepEnter) : undefined;
  const birthCheck = checkBirthday(birth);
  // The wheel always holds a date, so the error shows as soon as it lands on one under 18.
  const birthdayError = 'error' in birthCheck ? birthCheck.error : null;

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
  // Move VoiceOver and TalkBack to the new heading once it has faded in.
  useEffect(() => {
    if (from === null || Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (headingRef.current) AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus');
    }, Motion.enter);
    return () => clearTimeout(timer);
  }, [step, from]);

  function showBirthdayError(message: string) {
    haptics.error();
    // The hint's live region already speaks the error on Android and web.
    // Queued, so it follows the wheel's new value instead of cutting it off.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    }
  }

  /** One haptic per settled wheel: the error's when the date just became too young. */
  function changeBirth(next: BirthParts) {
    const nextCheck = checkBirthday(next);
    setBirth(next);
    if ('error' in nextCheck && birthdayError === null) showBirthdayError(nextCheck.error);
    else haptics.selection();
  }

  function handleContinue() {
    if (step === 'birthday') {
      if (birthdayError) {
        showBirthdayError(birthdayError);
        return;
      }
      goTo('gender');
    } else if (step === 'gender') {
      goTo('meet');
    } else if (step === 'meet') {
      goTo('terms');
    } else {
      finish();
    }
  }

  function finish() {
    const checked = checkBirthday(birth);
    if ('error' in checked) {
      goTo('birthday');
      showBirthdayError(checked.error);
      return;
    }
    if (!gender || !wantsToMeet) return;
    setOnboarding({
      birthDate: checked.birthDate,
      gender,
      wantsToMeet,
      termsAcceptedAt: new Date().toISOString(),
    });
    router.replace('/profile-setup');
  }

  async function handleTestProfile() {
    const answers = {
      birthDate: '2000-05-17',
      gender: 'woman' as const,
      wantsToMeet: 'man' as const,
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
    return (
      // Keyed per step, so every step mounts fresh and starts scrolled to the top.
      <Screen
        key="welcome"
        scroll
        footerStyle="plain"
        contentStyle={styles.welcomeContent}
        footer={
          <View style={styles.welcomeActions}>
            <Button title="Get started" onPress={() => goTo('birthday')} />
            {__DEV__ ? (
              <Button title="Skip with a test profile" variant="ghost" onPress={handleTestProfile} />
            ) : null}
          </View>
        }>
        <Animated.View key="welcome" entering={enter} style={styles.welcome}>
          <Wordmark />
          <View style={styles.welcomeAbove} />
          <View>
            {/* Drawn first so the line sits over its string. Decorative. */}
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.welcomeBalloon}>
              <Balloon color={theme.accent} size={160} />
            </View>
            <View
              ref={headingRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel="Be the last balloon.">
              <ThemedText type="hero" maxFontSizeMultiplier={1.5}>
                {'Be the last\nballoon.'}
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.welcomeBody}>
              In every room, one person chooses and five hold balloons. Each round, everyone answers
              the same question, one more photo appears, and one balloon pops. The last balloon left
              is the match.
            </ThemedText>
          </View>
          <View style={styles.welcomeBelow} />
        </Animated.View>
      </Screen>
    );
  }

  const canContinue =
    step === 'birthday'
      ? birthdayError === null
      : step === 'gender'
        ? gender !== null
        : step === 'meet'
          ? wantsToMeet !== null
          : termsAccepted;
  const days = DAYS.slice(0, daysInMonth(birth.month, birth.year));

  return (
    <Screen
      key={step}
      scroll
      footerStyle="plain"
      footer={
        <Button
          title="Continue"
          disabled={!canContinue}
          onPress={handleContinue}
          accessibilityHint={canContinue ? undefined : CONTINUE_HINTS[step]}
        />
      }>
      {/* The bar and Back sit in the same place on every question, so they only
          enter when you arrive from the welcome; after that only the question moves. */}
      <Animated.View key="chrome" entering={from === 'welcome' ? enter : undefined}>
        <View style={styles.progress}>
          <ProgressSegments
            total={SETUP_STEPS}
            filled={index}
            accessibilityLabel={setupStepLabel(index)}
          />
        </View>
        <View style={styles.back}>
          <BackButton onPress={() => goTo(STEPS[index - 1])} />
        </View>
      </Animated.View>

      <Animated.View key={step} entering={enter}>
        <View
          ref={headingRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${TITLES[step]}, ${setupStepLabel(index)}`}
          style={styles.title}>
          <ThemedText type="display">{TITLES[step]}</ThemedText>
        </View>

        {step === 'birthday' ? (
          <View style={styles.answer}>
            <WheelPicker
              invalid={birthdayError !== null}
              columns={[
                {
                  label: 'Day',
                  values: days,
                  selected: birth.day - 1,
                  onChange: (i) => changeBirth({ ...birth, day: i + 1 }),
                },
                {
                  label: 'Month',
                  values: MONTHS,
                  selected: birth.month - 1,
                  flex: 1.7,
                  onChange: (i) =>
                    changeBirth({
                      ...birth,
                      month: i + 1,
                      day: Math.min(birth.day, daysInMonth(i + 1, birth.year)),
                    }),
                },
                {
                  label: 'Year',
                  values: YEARS,
                  selected: birth.year - FIRST_YEAR,
                  onChange: (i) =>
                    changeBirth({
                      ...birth,
                      year: FIRST_YEAR + i,
                      day: Math.min(birth.day, daysInMonth(birth.month, FIRST_YEAR + i)),
                    }),
                },
              ]}
            />
            <BirthdayHint error={birthdayError} />
          </View>
        ) : null}

        {step === 'gender' ? (
          <View
            style={[styles.answer, styles.options]}
            accessibilityRole="radiogroup"
            accessibilityLabel={TITLES.gender}>
            <OptionRow label="Woman" selected={gender === 'woman'} onPress={() => setGender('woman')} />
            <OptionRow label="Man" selected={gender === 'man'} onPress={() => setGender('man')} />
          </View>
        ) : null}

        {step === 'meet' ? (
          <View
            style={[styles.answer, styles.options]}
            accessibilityRole="radiogroup"
            accessibilityLabel={TITLES.meet}>
            <OptionRow
              label="Women"
              selected={wantsToMeet === 'woman'}
              onPress={() => setWantsToMeet('woman')}
            />
            <OptionRow
              label="Men"
              selected={wantsToMeet === 'man'}
              onPress={() => setWantsToMeet('man')}
            />
          </View>
        ) : null}

        {step === 'terms' ? (
          <View style={styles.answer}>
            {/* The whole box is the checkbox; the links inside are read as part of its label. */}
            <PressableHighlight
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              // The web reads the state from ARIA, not from accessibilityState.
              aria-checked={termsAccepted}
              accessibilityLabel={TERMS_LABEL}
              onPress={toggleTerms}
              style={styles.terms}>
              <CheckMark checked={termsAccepted} shape="checkbox" />
              {/* TODO(Elias): link the real Terms and Privacy Policy here. Until then a tap
                  on either link toggles the box like the rest of it. */}
              <ThemedText style={styles.flex}>
                {"I'm 18 or older and agree to the "}
                <ThemedText accessibilityRole="link" style={styles.link}>
                  Terms
                </ThemedText>
                {' and '}
                <ThemedText accessibilityRole="link" style={styles.link}>
                  Privacy Policy
                </ThemedText>
                .
              </ThemedText>
            </PressableHighlight>
            {__DEV__ ? (
              <ThemedText type="footnote" themeColor="textTertiary" style={styles.footnote}>
                For now you play with a test account. Sign in with Apple comes before launch.
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

/** The birthday's note, or its error with an icon, in the same place under the wheel. */
function BirthdayHint({ error }: { error: string | null }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.hint}>
      {error ? (
        <Animated.View key="error" entering={errorEnter} style={styles.error}>
          <ErrorIcon />
          <ThemedText type="footnote" themeColor="danger" style={styles.flex}>
            {error}
          </ThemedText>
        </Animated.View>
      ) : (
        <ThemedText type="footnote" themeColor="textSecondary">
          {BIRTHDAY_HINT}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * The welcome's free height splits like the canvas's 812pt frame: 328pt between
 * the wordmark and the line, 38pt between the copy and the bottom padding.
 */
const WELCOME_ABOVE = 328;
const WELCOME_BELOW = 38;

const styles = StyleSheet.create({
  welcomeContent: {
    flexGrow: 1,
    // The wordmark sits 20pt down, where it does on Home.
    paddingTop: 20,
  },
  welcome: {
    flexGrow: 1,
  },
  welcomeAbove: {
    flexGrow: WELCOME_ABOVE,
    // Keeps the balloon below the wordmark's line however short the screen.
    minHeight: 120,
  },
  welcomeBelow: {
    flexGrow: WELCOME_BELOW,
  },
  // On the canvas the balloon's top is 156pt above the line and 26pt in from the right edge.
  welcomeBalloon: {
    position: 'absolute',
    top: -156,
    right: 6,
  },
  welcomeBody: {
    marginTop: Space.md,
  },
  welcomeActions: {
    gap: 6,
  },
  progress: {
    paddingTop: Space.xxs,
  },
  back: {
    marginTop: Space.xs,
  },
  title: {
    marginTop: Space.md,
  },
  answer: {
    marginTop: 28,
  },
  options: {
    gap: Space.xs,
  },
  hint: {
    marginTop: 10,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  link: {
    textDecorationLine: 'underline',
  },
  footnote: {
    marginTop: 14,
  },
  flex: {
    flex: 1,
  },
});
