import type { Translate } from '@/i18n';

/**
 * The setup before the first game, as the progress bar counts it: birthday,
 * I'm a, I want to meet and the fine print (onboarding), then the profile.
 * The welcome screen comes before and isn't a step.
 */
export const SETUP_STEPS = 5;

/**
 * For VoiceOver, with `step` counted from 1. Pass the screen's `t` so it's read
 * in the app's language; without it, it falls back to English.
 */
export function setupStepLabel(step: number, t?: Translate) {
  return t
    ? t('onboarding.stepOf', { step, total: SETUP_STEPS })
    : `Step ${step} of ${SETUP_STEPS}`;
}
