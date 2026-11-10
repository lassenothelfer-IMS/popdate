/**
 * AI-generated faces (thispersondoesnotexist.com: these people don't exist) for the
 * mock server's bots, so a room looks like it would with real people. Dev only: the
 * mock server loads this file only when EXPO_PUBLIC_DEMO_PHOTOS=1.
 */
import { Asset } from 'expo-asset';

import type { Gender } from './types';

const FILES: Record<Gender, number[]> = {
  woman: [
    require('../../dev-photos/woman/01.jpg'),
    require('../../dev-photos/woman/02.jpg'),
    require('../../dev-photos/woman/03.jpg'),
    require('../../dev-photos/woman/04.jpg'),
    require('../../dev-photos/woman/05.jpg'),
    require('../../dev-photos/woman/06.jpg'),
    require('../../dev-photos/woman/07.jpg'),
    require('../../dev-photos/woman/08.jpg'),
    require('../../dev-photos/woman/09.jpg'),
    require('../../dev-photos/woman/10.jpg'),
  ],
  man: [
    require('../../dev-photos/man/01.jpg'),
    require('../../dev-photos/man/02.jpg'),
    require('../../dev-photos/man/03.jpg'),
    require('../../dev-photos/man/04.jpg'),
    require('../../dev-photos/man/05.jpg'),
    require('../../dev-photos/man/06.jpg'),
    require('../../dev-photos/man/07.jpg'),
  ],
};

export const DEMO_PHOTOS: Record<Gender, string[]> = {
  woman: FILES.woman.map((m) => Asset.fromModule(m).uri),
  man: FILES.man.map((m) => Asset.fromModule(m).uri),
};
