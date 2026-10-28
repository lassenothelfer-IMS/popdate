import type { Translate } from '@/i18n';

/**
 * The setup before the first game, as the progress bar counts it: birthday,
 * I'm a, I want to meet and the house rules (onboarding), then photos, about
 * you (profile setup). The welcome and the three intro cards come before and
 * aren't steps.
 */
export const SETUP_STEPS = 6;

/**
 * For VoiceOver, with `step` counted from 1. Pass the screen's `t` so it's read
 * in the app's language; without it, it falls back to English.
 */
export function setupStepLabel(step: number, t?: Translate) {
  return t
    ? t('onboarding.stepOf', { step, total: SETUP_STEPS })
    : `Step ${step} of ${SETUP_STEPS}`;
}
