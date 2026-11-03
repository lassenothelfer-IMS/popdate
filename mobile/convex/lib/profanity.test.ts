import { expect, test } from 'vitest';

import { hasProfanity, maskProfanity } from '../../src/utils/profanity';

test.each([
  ['fuck', '••••'],
  ['You are a fucking legend', 'You are a ••••••• legend'],
  ['FUCK!', '••••!'],
  ['Scheiße', '•••••••'],
  ['enculé', '••••••'],
  // Endings
  ['bitches', '•••••••'],
  ['assholes', '••••••••'],
  ['Schlampen', '•••••••••'],
  ['stronzi', '•••••••'],
  // Stretched letters
  ['fuuuck', '••••••'],
  ['shiiit', '••••••'],
  // Digits and symbols for letters
  ['sh1t', '••••'],
  ['a$$hole', '•••••••'],
  ['$hit', '••••'],
  ['b!tch', '•••••'],
  // Stars for letters
  ['f*ck', '••••'],
  ['sh*t', '••••'],
  ['f**k', '••••'],
  // Letters kept apart
  ['f u c k', '•••••••'],
  ['oh f u c k off', 'oh ••••••• off'],
  ['f.u.c.k', '•••••••'],
  ['f-u-c-k', '•••••••'],
  ['what a s.h.i.t day', 'what a ••••••• day'],
  // One part of a longer word
  ['shit-show', '••••-show'],
  ["l'enculé", "l'••••••"],
])('masks %s', (text, masked) => {
  expect(maskProfanity(text)).toBe(masked);
  expect(hasProfanity(text)).toBe(true);
});

test.each([
  'Hello there, how was your day?',
  // Close to a filtered word, but ordinary words
  'cone',
  'conned',
  'pricked',
  'Connor',
  'Dickens',
  'class',
  'assess',
  'Scunthorpe',
  'unique',
  'computer',
  // Numbers, dates, symbols and addresses
  '4711',
  '10:30',
  '3.5 km',
  '$100!',
  'I am 5 4 1',
  'hello@example.com',
  'https://popdate.app/a-b_c',
  '*hello*',
  '***',
  "don't",
  'a b c',
])('leaves %s alone', (text) => {
  expect(maskProfanity(text)).toBe(text);
  expect(hasProfanity(text)).toBe(false);
});
