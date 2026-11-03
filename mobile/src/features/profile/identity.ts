import type { Gender, Profile } from '@/api';
import type { Translate } from '@/i18n';

/**
 * The genders you can pick, in the order they're offered. The first three are
 * rows of their own; the rest sit under them as chips.
 */
export const IDENTITIES = [
  'woman',
  'man',
  'nonbinary',
  'transWoman',
  'transMan',
  'genderqueer',
  'genderfluid',
  'agender',
  'bigender',
  'intersex',
  'twoSpirit',
  'questioning',
] as const;

export type Identity = (typeof IDENTITIES)[number];

export const MAIN_IDENTITIES = 3;

/** Optional, and only shown when you pick one. */
export const SEXUALITIES = [
  'straight',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
  'queer',
  'asexual',
  'demisexual',
  'questioning',
] as const;

export type Sexuality = (typeof SEXUALITIES)[number];

function isIdentity(value: string | undefined): value is Identity {
  return IDENTITIES.includes(value as Identity);
}

function isSexuality(value: string | undefined): value is Sexuality {
  return SEXUALITIES.includes(value as Sexuality);
}

/**
 * The side of the room an identity plays on, or null when it's yours to choose.
 * Rooms are matched from two groups, so everyone still needs one.
 */
export function sideOf(identity: Identity): Gender | null {
  if (identity === 'woman' || identity === 'transWoman') return 'woman';
  if (identity === 'man' || identity === 'transMan') return 'man';
  return null;
}

/** Your identity as saved, or the plain side for a profile made before there was a choice. */
export function identityOf(profile: Pick<Profile, 'gender' | 'genderIdentity'>): Identity {
  return isIdentity(profile.genderIdentity) ? profile.genderIdentity : profile.gender;
}

/** `key('identity', 'transWoman')` is `'profile.identityTransWoman'`, typed so a missing string fails to compile. */
function key<P extends string, V extends string>(prefix: P, value: V) {
  return `profile.${prefix}${value[0].toUpperCase()}${value.slice(1)}` as `profile.${P}${Capitalize<V>}`;
}

export function identityLabel(t: Translate, identity: Identity) {
  return t(key('identity', identity));
}

export function sexualityLabel(t: Translate, sexuality: Sexuality) {
  return t(key('sexuality', sexuality));
}

/** "Non-binary · they/them · Queer": what your profile says about gender and sexuality. */
export function identityLine(t: Translate, profile: Profile) {
  return [
    identityLabel(t, identityOf(profile)),
    profile.genderDetails?.trim(),
    isSexuality(profile.sexuality) ? sexualityLabel(t, profile.sexuality) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function asSexuality(value: string | undefined): Sexuality | null {
  return isSexuality(value) ? value : null;
}
