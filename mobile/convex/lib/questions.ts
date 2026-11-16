import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { QUESTION_TEXTS } from '../../src/shared/questions';

/**
 * The active questions. The starting list lives in `src/shared/questions.ts`
 * with its translations; any of it not in the table yet is added here, so new
 * questions reach a deployment that already has rooms. Edit or add questions in
 * the dashboard; `active: false` retires one (deleting a starting question
 * would only bring it back).
 */
export async function questionPool(ctx: MutationCtx) {
  const all = await ctx.db.query('questions').collect();
  const known = new Set(all.map((question) => question.text));
  const added: Doc<'questions'>[] = [];
  for (const text of QUESTION_TEXTS) {
    if (known.has(text)) continue;
    const id = await ctx.db.insert('questions', { text, active: true });
    added.push((await ctx.db.get(id))!);
  }
  return [...all, ...added].filter((question) => question.active);
}
