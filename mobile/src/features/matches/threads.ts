import { api, type Match, type Message } from '@/api';
import type { Translate } from '@/i18n';

/** A match with its newest message, if anyone has written yet. */
export type Thread = { match: Match; last: Message | null };

/** Each match with its newest message. A chat that won't load reads as quiet. */
export function withLastMessages(matches: readonly Match[]): Promise<Thread[]> {
  return Promise.all(
    matches.map(async (match) => {
      const messages = await api.listMessages(match.id).catch(() => []);
      return { match, last: messages.at(-1) ?? null };
    }),
  );
}

/**
 * The line under a match: their newest message (through your comment filter),
 * "You: …" when you wrote last, or a nudge while nobody has written yet.
 */
export function previewLine(
  t: Translate,
  filter: (text: string) => string,
  { last }: Thread,
  myId: string | null,
) {
  if (!last) return t('home.matchNote');
  return last.senderId === myId ? t('home.youWrote', { text: last.text }) : filter(last.text);
}
