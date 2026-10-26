/**
 * A small word filter for answers and chat messages, in the app's four
 * languages. The server will run its own (and stricter) filter for everyone;
 * this one backs the "Hide offensive words" setting on your phone.
 *
 * Words are matched whole and case-insensitively, ignoring accents, and a
 * match is replaced with bullets of the same length so the sentence keeps its shape.
 */

const WORDS = [
  // English
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'slut',
  'whore', 'retard', 'faggot', 'motherfucker', 'bullshit', 'prick', 'twat', 'wanker',
  // German
  'scheisse', 'scheiße', 'arschloch', 'fotze', 'hurensohn', 'hure', 'wichser', 'schlampe',
  'fick', 'ficken', 'missgeburt', 'spast', 'schwuchtel', 'drecksau', 'vollidiot',
  // French
  'merde', 'putain', 'connard', 'connasse', 'salope', 'enculé', 'encule', 'pute', 'batard',
  'bâtard', 'nique', 'pédé', 'pede', 'conne',
  // Italian
  'cazzo', 'stronzo', 'stronza', 'vaffanculo', 'puttana', 'troia', 'merda', 'coglione',
  'frocio', 'bastardo', 'figa',
];

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const FOLDED = new Set(WORDS.map(fold));

/** True if the text contains a filtered word. */
export function hasProfanity(text: string) {
  return text.split(/[^\p{L}']+/u).some((word) => word && FOLDED.has(fold(word)));
}

/** The text with every filtered word replaced by bullets of the same length. */
export function maskProfanity(text: string) {
  return text.replace(/[\p{L}']+/gu, (word) => (FOLDED.has(fold(word)) ? '•'.repeat(word.length) : word));
}
