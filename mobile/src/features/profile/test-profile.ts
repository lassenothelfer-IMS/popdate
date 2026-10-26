import type { ProfileDetails } from '@/state/session';

/** Dev only: a filled-in profile so you can get to the game in one tap. */
export function testProfileDetails(): ProfileDetails {
  return {
    name: 'Alex',
    city: 'Zurich',
    heightCm: 172,
    job: 'Student',
    bio: 'Here to pop some balloons.',
    photos: testPhotos(),
  };
}

export function testPhotos() {
  return Array.from({ length: 6 }, (_, i) => `mock://me/${i + 1}`);
}
