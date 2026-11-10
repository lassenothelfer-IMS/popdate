import { demoPhotos } from '@/api/mock-server';
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

/** Six AI faces in a development build (one per photo), placeholders anywhere else. */
export function testPhotos() {
  const faces = demoPhotos();
  const pool = faces ? [...faces.man, ...faces.woman] : [];
  return Array.from({ length: 6 }, (_, i) => pool[i] ?? `mock://me/${i + 1}`);
}
