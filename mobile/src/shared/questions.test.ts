import { describe, expect, test } from 'vitest';

import { localizeQuestion, QUESTIONS, QUESTION_TEXTS } from './questions';

describe('questions', () => {
  test('every question has all four languages, and no English text twice', () => {
    for (const question of QUESTIONS) {
      for (const language of ['en', 'de', 'fr', 'it'] as const) {
        expect(question[language].trim()).not.toBe('');
      }
    }
    expect(new Set(QUESTION_TEXTS).size).toBe(QUESTION_TEXTS.length);
  });

  test('a known question comes back in the language, any other as written', () => {
    expect(localizeQuestion("What's a dealbreaker for you?", 'de')).toBe('Was ist für dich ein Dealbreaker?');
    expect(localizeQuestion("What's a dealbreaker for you?", 'en')).toBe("What's a dealbreaker for you?");
    expect(localizeQuestion('A question from the dashboard?', 'fr')).toBe('A question from the dashboard?');
  });
});
