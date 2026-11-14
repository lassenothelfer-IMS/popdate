import type { VideoSource } from 'expo-video';

/**
 * One place for the app's lifestyle imagery. To swap in a licensed photo or
 * video, drop the file into `assets/images` or `assets/video` and point the
 * slot at it here; nothing else changes.
 *
 * `image` is always needed: it is what shows while a video loads, and all that
 * shows under Reduce Motion. `video` is optional, a short muted loop.
 *
 * The files below are placeholders until the licensed assets arrive.
 */
export type ImagerySlot = {
  image: number;
  video?: VideoSource;
};

const LIGHT = require('../../assets/images/plus-hero-light.jpg') as number;
const WARM = require('../../assets/images/popdate_welcome_poster.jpg') as number;

export const Imagery = {
  /** Behind the balloon on Play. */
  play: { image: LIGHT },
  /** Rooms, before your first room. */
  emptyRooms: { image: WARM },
  /** Matches, before your first match. */
  emptyMatches: { image: LIGHT },
} satisfies Record<string, ImagerySlot>;
