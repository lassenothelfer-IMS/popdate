import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Interest } from '@/api';
import { Button } from '@/components/button';
import { ErrorIcon, errorEnter } from '@/components/error-line';
import { ProgressSegments } from '@/components/progress-segments';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { VideoBackground } from '@/components/video-background';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Fonts, Gutter, Motion, Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { SETUP_STEPS, setupStepLabel } from '@/features/onboarding/setup-steps';
import { AppleSignIn } from '@/features/onboarding/apple-sign-in';
import {
  IdentityPicker,
  MeetPicker,
  resolvedSide,
  type IdentityChoice,
} from '@/features/profile/gender-section';
import { testProfileDetails } from '@/features/profile/test-profile';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import { useSession } from '@/state/session';
import { MAX_AGE, ageFromBirthDate, parseBirthDate } from '@/utils/birth-date';
import { haptics } from '@/utils/haptics';

/**
 * The welcome with Sign in with Apple on it, then one question per screen: your first
 * name, birthday, gender and who you want to meet. Photos and the house rules
 * follow on the profile setup route. How the game works is taught in the
 * first room, next to each action, not on slides up front.
 */
const STEPS = ['welcome', 'name', 'birthday', 'gender', 'meet'] as const;
type Step = (typeof STEPS)[number];
type Question = 'name' | 'birthday' | 'gender' | 'meet';

const QUESTIONS: Question[] = ['name', 'birthday', 'gender', 'meet'];

/** Translation keys of each question's title and the line under it. */
const TITLES: Record<Question, TranslationKey> = {
  name: 'onboarding.titleName',
  birthday: 'onboarding.titleBirthday',
  gender: 'onboarding.titleGender',
  meet: 'onboarding.titleMeet',
};
const SUBTITLES: Record<Question, TranslationKey> = {
  name: 'onboarding.subtitleName',
  birthday: 'onboarding.subtitleBirthday',
  gender: 'onboarding.subtitleGender',
  meet: 'onboarding.subtitleMeet',
};

/** Read by VoiceOver on Continue while the step isn't answered yet (translation keys). */
const CONTINUE_HINTS: Record<Question, TranslationKey> = {
  name: 'onboarding.hintName',
  birthday: 'onboarding.hintBirthday',
  gender: 'onboarding.hintChoose',
  meet: 'onboarding.hintChoose',
};

/** The longest first name a profile takes (the server's limit). */
const NAME_MAX = 50;

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
  | { error: TranslationKey } {
  if (!day || !month || year.length < 4) return { pending: true };
  const birthDate = parseBirthDate(day, month, year);
  if (!birthDate) return { error: 'onboarding.birthdayInvalid' };
  const age = ageFromBirthDate(birthDate);
  // Older than anyone alive is a typo in the year, not a birthday.
  if (age > MAX_AGE) return { error: 'onboarding.birthdayInvalid' };
  if (age < 18) return { error: 'onboarding.birthdayTooYoung' };
  return { birthDate, age };
}

export function OnboardingScreen() {
  const { failed, signedIn, onboarding, setOnboarding, saveProfile, signInAsGuest } = useSession();
  const theme = useTheme();
  const t = useT();
  const reduced = useReduceMotion();
  const [step, setStep] = useState<Step>('welcome');
  // The step you came from: the screen entrance only plays on a change.
  const [from, setFrom] = useState<Step | null>(null);
  const headingRef = useRef<ViewInstance>(null);
  const [firstName, setFirstName] = useState(onboarding?.firstName ?? '');
  /** The web's "You're 27. Right?", asked in a sheet. Null while nothing is asked. */
  const [askingAge, setAskingAge] = useState<number | null>(null);
  const [birth, setBirth] = useState<BirthEntry>({ day: '', month: '', year: '' });
  const [identity, setIdentity] = useState<IdentityChoice>({ identity: null, side: null });
  const gender = resolvedSide(identity);
  const [wantsToMeet, setWantsToMeet] = useState<Interest | null>(null);
  // The gender step scrolls itself, so it can bring the side question into view.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);

  const birthCheck = checkBirthday(birth);
  const birthdayError = 'error' in birthCheck ? t(birthCheck.error) : null;

  function goTo(next: Step) {
    setFrom(step);
    setStep(next);
  }

  /** The step Back goes to. */
  function previousOf(current: Step): Step {
    return STEPS[Math.max(0, STEPS.indexOf(current) - 1)];
  }

  // Android's back button walks back through the steps before it leaves onboarding.
  const backTo = step === 'welcome' ? null : previousOf(step);
  useEffect(() => {
    if (!backTo) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setFrom(step);
      setStep(backTo);
      return true;
    });
    return () => subscription.remove();
  }, [step, backTo]);

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
    if (step === 'name') {
      if (firstName.trim()) goTo('birthday');
    } else if (step === 'birthday') {
      if ('birthDate' in birthCheck) confirmAge(birthCheck.age);
    } else if (step === 'gender') {
      goTo('meet');
    } else {
      finish();
    }
  }

  /** "You're 24. Right?": the age can't be changed later, so it is checked once, natively. */
  function confirmAge(age: number) {
    const title = t('onboarding.ageConfirmTitle', { age });
    const message = t('onboarding.ageConfirmBody');
    // Alert does nothing on the web, and browsers can block their own confirm: the web asks in a sheet.
    if (Platform.OS === 'web') {
      setAskingAge(age);
      return;
    }
    Alert.alert(title, message, [
      { text: t('onboarding.ageConfirmChange'), style: 'cancel' },
      { text: t('onboarding.ageConfirmYes'), onPress: () => goTo('gender') },
    ]);
  }

  function finish() {
    if (!('birthDate' in birthCheck)) {
      goTo('birthday');
      return;
    }
    if (!gender || !wantsToMeet || !firstName.trim()) return;
    setOnboarding({
      firstName: firstName.trim(),
      birthDate: birthCheck.birthDate,
      gender,
      wantsToMeet,
      genderIdentity: identity.identity ?? undefined,
      // Set for real when you agree to the house rules, after your photos.
      termsAcceptedAt: '',
    });
    router.replace('/profile-setup');
  }

  /** Signed in: straight to the profile when you have one, otherwise on to your name. */
  function signedInNow(hasProfile: boolean, givenName?: string | null) {
    if (hasProfile) {
      router.replace('/');
      return;
    }
    // Apple shares your first name the first time you sign in: it's filled in for you.
    if (givenName && !firstName) setFirstName(givenName.slice(0, NAME_MAX));
    goTo('name');
  }

  async function handleTestProfile() {
    if (!signedIn) await signInAsGuest();
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

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }

  /**
   * "Which side of the room?" appears under the identities, often below the
   * fold. Scroll until it sits above Continue, or its top does if it's taller.
   */
  function revealSide(side: ViewInstance) {
    // A frame later, once the new rows are laid out.
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      scroller.measureInWindow((_vx, viewTop, _vw, viewHeight) => {
        side.measureInWindow((_x, top, _w, height) => {
          const below = top + height - (viewTop + viewHeight - Space.md);
          if (below <= 0) return;
          const delta = Math.min(below, top - (viewTop + Space.md));
          scroller.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: !reduced });
        });
      });
    });
  }

  // Signing in again after signing out failed: the start screen offers to try again.
  if (failed) return <Redirect href="/" />;

  if (step === 'welcome') {
    return (
      <Screen
        key="welcome"
        footerStyle="plain"
        contentStyle={styles.bare}
        background={
          <>
            <VideoBackground video={WELCOME_VIDEO} poster={WELCOME_POSTER} tint={theme.page} />
            {/* The canvas color over the lower video, so the dark copy reads on it without a glow. */}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
              <Defs>
                <LinearGradient id="welcomeWash" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.42" stopColor={theme.page} stopOpacity={0} />
                  <Stop offset="0.68" stopColor={theme.page} stopOpacity={0.35} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#welcomeWash)" />
            </Svg>
          </>
        }
        footer={
          <Rise index={3} style={styles.welcomeActions}>
            {/* Signing in is the first step, right here. Already signed in (back mid-setup): carry on. */}
            {signedIn ? (
              <Button
                title={t('onboarding.getStarted')}
                onPress={() => {
                  haptics.light();
                  goTo('name');
                }}
              />
            ) : (
              <AppleSignIn onSignedIn={signedInNow} />
            )}
            {__DEV__ ? (
              <Button title={t('onboarding.skipTest')} variant="plain" onPress={handleTestProfile} />
            ) : null}
          </Rise>
        }>
        {/* Fits the screen and never bounces. Only large text sizes make it scroll, so the copy never runs under the buttons. */}
        <ScrollView
          bounces={false}
          overScrollMode="never"
          style={styles.flex}
          contentContainerStyle={styles.welcomeContent}>
          <Rise index={0}>
            <Wordmark />
          </Rise>
          <View style={styles.welcomeStage}>
            <Rise index={1} style={styles.welcomeHero}>
              <View
                ref={headingRef}
                accessible
                accessibilityRole="header"
                accessibilityLabel={t('onboarding.heroLabel')}>
                <ThemedText type="hero" maxFontSizeMultiplier={1.4} style={styles.heroLine}>
                  {t('onboarding.hero')}
                </ThemedText>
              </View>
            </Rise>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const question = step as Question;
  const number = QUESTIONS.indexOf(question) + 1;
  const canContinue =
    question === 'name'
      ? firstName.trim().length > 0
      : question === 'birthday'
        ? 'birthDate' in birthCheck
        : question === 'gender'
          ? gender !== null
          : wantsToMeet !== null;
  const stepLabel = setupStepLabel(number, t);
  const title = t(TITLES[question]);
  const previous = previousOf(question);

  // The gender step scrolls in a view of its own, which revealSide can move.
  const ownScroll = question === 'gender';
  const body = (
    <>
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
        <ThemedText type="body">{t(SUBTITLES[question])}</ThemedText>
      </Rise>

      <Rise index={2} style={styles.answer}>
        {question === 'name' ? (
          <TextField
            value={firstName}
            onChangeText={(text) => setFirstName(text.slice(0, NAME_MAX))}
            placeholder={t('onboarding.namePlaceholder')}
            accessibilityLabel={title}
            autoFocus
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            onSubmitEditing={handleContinue}
            style={styles.nameInput}
          />
        ) : null}

        {question === 'birthday' ? (
          <Birthday birth={birth} onChange={setBirth} check={birthCheck} error={birthdayError} />
        ) : null}

        {question === 'gender' ? (
          <IdentityPicker value={identity} onChange={setIdentity} label={title} onSideShown={revealSide} />
        ) : null}

        {question === 'meet' ? <MeetPicker value={wantsToMeet} onChange={setWantsToMeet} label={title} /> : null}

      </Rise>
    </>
  );

  return (
    <Screen
      key={question}
      scroll={!ownScroll}
      contentStyle={ownScroll ? styles.bare : undefined}
      footerStyle="plain"
      footer={
        <Button
          title={t('common.continue')}
          disabled={!canContinue}
          onPress={handleContinue}
          accessibilityHint={canContinue ? undefined : t(CONTINUE_HINTS[question])}
        />
      }>
      {ownScroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.flex}
          contentContainerStyle={styles.ownScroll}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      <Sheet visible={askingAge !== null} onClose={() => setAskingAge(null)}>
        <View style={styles.ageAsk}>
          <ThemedText type="title" accessibilityRole="header">
            {t('onboarding.ageConfirmTitle', { age: askingAge ?? 0 })}
          </ThemedText>
          <ThemedText type="body">{t('onboarding.ageConfirmBody')}</ThemedText>
        </View>
        <View style={styles.ageAskActions}>
          <Button
            title={t('onboarding.ageConfirmYes')}
            onPress={() => {
              setAskingAge(null);
              goTo('gender');
            }}
          />
          <Button title={t('onboarding.ageConfirmChange')} variant="plain" onPress={() => setAskingAge(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}

/** The welcome's looping background and its first frame (see VideoBackground). */
const WELCOME_VIDEO = require('../../../assets/video/popdate_welcome_loop.mp4');
const WELCOME_POSTER = require('../../../assets/images/popdate_welcome_poster.jpg');

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
    // More than one digit at once is a paste or AutoFill: it may fill the fields after this one.
    // One digit typed into a full field never overwrites the next field's answer.
    const pasted = rest.length - birth[parts[index].key].length > 1;
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
      if (!pasted && i + 1 < parts.length && next[parts[i + 1].key] !== '') break;
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
              // No birthday AutoFill hints: iOS shows and hides its suggestion bar over the
              // number pad as each field fills, and every change of the keyboard's height
              // moved Continue and the page while you typed.
              keyboardType="number-pad"
              placeholder={part.placeholder}
              error={error !== null}
              accessibilityHint={error ?? undefined}
              style={styles.birthInput}
            />
          </View>
        ))}
      </View>
      {/* Holds the age card's room from the start, so the page never grows or shrinks as the age or an error comes and goes. */}
      <View accessibilityLiveRegion="polite" style={styles.birthResult}>
        {error ? (
          <Animated.View key="error" entering={errorEnter} style={styles.error}>
            <ErrorIcon />
            <ThemedText type="footnote" themeColor="danger" style={styles.flex}>
              {error}
            </ThemedText>
          </Animated.View>
        ) : 'age' in check ? (
          <Animated.View entering={errorEnter} style={styles.ageLine}>
            <Text style={[styles.age, { color: theme.text }]}>{check.age}</Text>
            <ThemedText type="body" style={styles.flex}>
              {t('onboarding.ageSeen')}
            </ThemedText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContent: {
    flexGrow: 1,
    paddingHorizontal: Gutter,
    paddingTop: 10,
    paddingBottom: Space.lg,
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
  welcomeActions: {
    gap: 6,
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
  // The age card's height: 14 pt padding twice, the 30 pt number and its 1 pt border.
  birthResult: {
    minHeight: 60,
  },
  // How old the room will see you: the number large, on the page, no box around it.
  ageLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  nameInput: {
    fontFamily: Fonts.serif,
    fontSize: 24,
  },
  age: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  ageAsk: {
    gap: Space.xs,
    marginTop: Space.xs,
  },
  ageAskActions: {
    gap: 6,
  },
  /** The Screen's own padding moves inside the gender step's scroll view. */
  bare: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  ownScroll: {
    paddingHorizontal: Gutter,
    paddingTop: Space.sm,
    // Room under the last side option, so it never ends flush on Continue.
    paddingBottom: Space.xl,
  },
});
