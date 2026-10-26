import type { MutationCtx } from '../_generated/server';

/** The starting list. Edit or add questions in the dashboard; `active: false` retires one. */
const DEFAULT_QUESTIONS = [
  'What would your friends say is your worst habit?',
  "What's the most spontaneous thing you've ever done?",
  'What does your perfect Sunday look like?',
  "What's a red flag you secretly have?",
  "What's the last thing that made you laugh really hard?",
  'Which song plays when you walk into a room?',
  "What's your most controversial food opinion?",
  'What would you do with a free week and no money?',
  "What's something you're weirdly good at?",
  "What's your go-to karaoke song?",
  "What's the best date you've ever been on?",
  'Cats or dogs? Defend your answer.',
  "What's a dealbreaker for you?",
  'What would your ex say about you?',
  "What's your biggest ick?",
  'What are you irrationally scared of?',
];

/** The active questions, adding the starting list the first time a room needs it. */
export async function questionPool(ctx: MutationCtx) {
  const all = await ctx.db.query('questions').collect();
  if (all.length > 0) return all.filter((question) => question.active);

  for (const text of DEFAULT_QUESTIONS) {
    await ctx.db.insert('questions', { text, active: true });
  }
  return await ctx.db.query('questions').collect();
}
