import type { Units } from '@/api';

const CM_PER_INCH = 2.54;

/** A height for display: "183 cm", or "6′0″" in imperial units. Heights are always stored in cm. */
export function formatHeight(cm: number, units: Units) {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′${inches}″`;
}

export function cmToFeetInches(cm: number) {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function feetInchesToCm(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * CM_PER_INCH);
}
