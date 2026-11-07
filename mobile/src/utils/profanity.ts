/**
 * A word filter for answers and chat messages, in the app's four languages. The
 * server runs it on everything before anyone else can read it, and it backs the
 * "Hide offensive words" setting on your phone.
 *
 * Words are matched whole, ignoring case and accents, and a match is replaced with
 * bullets of the same length so the sentence keeps its shape. It also sees through
 * the usual disguises: stretched letters (fuuuck), digits and symbols for letters
 * (sh1t, a$$hole), a star for a letter (f*ck), and letters kept apart (f u c k, f.u.c.k).
 *
 * Endings are listed word by word, not guessed, because a rule like "add -ed" would
 * also hit ordinary words (conned, pricked).
 */

const WORDS = [
  // English
  'fuck', 'fucks', 'fucked', 'fuckin', 'fucking', 'fucker', 'fuckers', 'motherfucker',
  'motherfuckers', 'motherfucking', 'shit', 'shits', 'shitty', 'shithead', 'bullshit', 'bitch',
  'bitches', 'bitchy', 'bastard', 'bastards', 'asshole', 'assholes', 'dick', 'dicks', 'dickhead',
  'cunt', 'cunts', 'slut', 'sluts', 'slutty', 'whore', 'whores', 'retard', 'retards', 'retarded',
  'faggot', 'faggots', 'prick', 'pricks', 'twat', 'twats', 'wanker', 'wankers',
  // German
  'scheisse', 'scheiße', 'scheiss', 'scheiß', 'arschloch', 'arschlöcher', 'arschloecher', 'fotze',
  'fotzen', 'hurensohn', 'hurensöhne', 'hurensoehne', 'hure', 'huren', 'wichser', 'schlampe',
  'schlampen', 'fick', 'ficken', 'fickt', 'gefickt', 'missgeburt', 'missgeburten', 'spast', 'spasti',
  'spasten', 'schwuchtel', 'schwuchteln', 'drecksau', 'drecksäue', 'vollidiot', 'vollidioten',
  // French
  'merde', 'merdes', 'putain', 'connard', 'connards', 'connasse', 'connasses', 'salope', 'salopes',
  'enculé', 'enculés', 'enculer', 'pute', 'putes', 'batard', 'batards', 'bâtard', 'bâtards', 'nique',
  'niquer', 'pédé', 'pédés', 'conne', 'connes',
  // Italian
  'cazzo', 'cazzi', 'stronzo', 'stronza', 'stronzi', 'stronze', 'vaffanculo', 'puttana', 'puttane',
  'troia', 'troie', 'merda', 'coglione', 'coglioni', 'frocio', 'froci', 'bastardo', 'bastardi',
  'figa', 'fighe',
];

/** What people type for a letter. */
const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const FOLDED = [...new Set(WORDS.map(fold))];

/** Every letter may be stretched: f+u+c+k+. A double letter stays double, so "cone" isn't "conne". */
const STRETCHED = new RegExp(
  `^(?:${FOLDED.map((word) => [...word].map((letter) => `${letter}+`).join('')).join('|')})$`,
  'u',
);

/** A star stands for one letter, so "f*ck" is tried against the words of its length. */
function matchesWithStars(token: string) {
  return FOLDED.some(
    (word) =>
      word.length === token.length &&
      [...token].every((char, index) => char === '*' || char === word[index]),
  );
}

/** Whether a word, with its disguises taken off, is a filtered word. */
function isFiltered(token: string) {
  const folded = fold(token);
  // Only digits and symbols, like "4711" or "$100": nothing to read as a word.
  if (!/\p{L}/u.test(folded)) return false;
  const plain = [...folded].map((char) => LOOKALIKES[char] ?? char).join('');
  return plain.includes('*') ? matchesWithStars(plain) : STRETCHED.test(plain);
}

/** Letters, and what stands in for them, inside a word. */
const CHAR = "[\\p{L}\\p{N}@$!*']";
/** One word, with dots, dashes or underscores inside it: f.u.c.k, shit-head. */
const WORD = new RegExp(`${CHAR}+(?:[._-]+${CHAR}+)*`, 'gu');
/** At least three single letters kept apart by spaces: f u c k. */
const SPACED = /(^|[^\p{L}\p{N}@$])([\p{L}\p{N}@$](?: +[\p{L}\p{N}@$]){2,})(?![\p{L}\p{N}@$])/gu;
/** What joins the parts of a word. */
const JOINERS = /[._'-]+/;

function bullets(text: string) {
  return '•'.repeat(text.length);
}

function maskWord(raw: string) {
  // "shit!" is the word shit: a mark at either end belongs to the sentence, not to the word.
  const [, before, core, after] = raw.match(/^(['!*]*)(.*?)(['!*]*)$/su) ?? ['', '', raw, ''];
  if (!core) return raw;
  const parts = core.split(JOINERS);
  if (isFiltered(parts.join(''))) return `${before}${bullets(core)}${after}`;
  if (parts.length === 1) return raw;
  // Not a word when joined up, but each part can still be one: shit-show, l'enculé.
  const masked = core.replace(/[^._'-]+/g, (part) => (isFiltered(part) ? bullets(part) : part));
  return `${before}${masked}${after}`;
}

/** The text with every filtered word replaced by bullets of the same length. */
export function maskProfanity(text: string) {
  return text
    .replace(SPACED, (whole, start: string, run: string) =>
      isFiltered(run.replace(/ +/g, '')) ? `${start}${bullets(run)}` : whole,
    )
    .replace(WORD, maskWord);
}

/** True if the text contains a filtered word. */
export function hasProfanity(text: string) {
  return maskProfanity(text) !== text;
}
