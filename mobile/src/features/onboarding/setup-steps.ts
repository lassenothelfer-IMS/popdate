/**
 * The setup before the first game, as the progress bar counts it: birthday,
 * I'm a, I want to meet and the fine print (onboarding), then the profile.
 * The welcome screen comes before and isn't a step.
 */
export const SETUP_STEPS = 5;

/** For VoiceOver, with `step` counted from 1. */
export function setupStepLabel(step: number) {
  return `Step ${step} of ${SETUP_STEPS}`;
}
