/**
 * The questions a chooser picks from, in every language the app speaks. One
 * list for the app, the mock and the server (`convex/lib/questions.ts` seeds
 * the English ones). Relative imports only: Convex bundles this file too.
 *
 * The server stores and sends the English text; the app shows it in the
 * reader's language by looking that text up here. A question added or edited
 * in the Convex dashboard isn't in this list, so it shows as written.
 */

export type QuestionLanguage = 'en' | 'de' | 'fr' | 'it';

export type QuestionText = Record<QuestionLanguage, string>;

export const QUESTIONS: readonly QuestionText[] = [
  {
    en: 'What would your friends say is your worst habit?',
    de: 'Was ist laut deinen Freunden deine schlimmste Angewohnheit?',
    fr: 'Selon tes amis, quelle est ta pire habitude ?',
    it: 'Secondo i tuoi amici, qual è la tua peggiore abitudine?',
  },
  {
    en: "What's the most spontaneous thing you've ever done?",
    de: 'Was ist das Spontanste, das du je gemacht hast?',
    fr: 'Quelle est la chose la plus spontanée que tu aies faite ?',
    it: 'Qual è la cosa più spontanea che tu abbia mai fatto?',
  },
  {
    en: 'What does your perfect Sunday look like?',
    de: 'Wie sieht dein perfekter Sonntag aus?',
    fr: 'À quoi ressemble ton dimanche parfait ?',
    it: 'Com’è la tua domenica perfetta?',
  },
  {
    en: "What's a red flag you secretly have?",
    de: 'Welche Red Flag hast du heimlich?',
    fr: 'Quel red flag as-tu en secret ?',
    it: 'Quale red flag hai in segreto?',
  },
  {
    en: "What's the last thing that made you laugh really hard?",
    de: 'Worüber hast du zuletzt richtig fest gelacht?',
    fr: 'Quelle est la dernière chose qui t’a fait vraiment rire ?',
    it: 'Qual è l’ultima cosa che ti ha fatto ridere davvero?',
  },
  {
    en: 'Which song plays when you walk into a room?',
    de: 'Welcher Song läuft, wenn du einen Raum betrittst?',
    fr: 'Quelle chanson passe quand tu entres dans une pièce ?',
    it: 'Quale canzone parte quando entri in una stanza?',
  },
  {
    en: "What's your most controversial food opinion?",
    de: 'Was ist deine umstrittenste Meinung übers Essen?',
    fr: 'Quelle est ton opinion culinaire la plus controversée ?',
    it: 'Qual è la tua opinione più controversa sul cibo?',
  },
  {
    en: 'What would you do with a free week and no money?',
    de: 'Was würdest du mit einer freien Woche und ohne Geld machen?',
    fr: 'Que ferais-tu d’une semaine libre sans argent ?',
    it: 'Cosa faresti con una settimana libera e senza soldi?',
  },
  {
    en: "What's something you're weirdly good at?",
    de: 'Worin bist du seltsam gut?',
    fr: 'Quel est ton talent le plus bizarre ?',
    it: 'Qual è il tuo talento più strano?',
  },
  {
    en: "What's your go-to karaoke song?",
    de: 'Was ist dein Karaoke-Song?',
    fr: 'Quelle est ta chanson de karaoké ?',
    it: 'Qual è la tua canzone da karaoke?',
  },
  {
    en: "What's the best date you've ever been on?",
    de: 'Was war dein bestes Date?',
    fr: 'Quel est le meilleur rendez-vous de ta vie ?',
    it: 'Qual è stato il tuo appuntamento migliore?',
  },
  {
    en: 'Cats or dogs? Defend your answer.',
    de: 'Katzen oder Hunde? Begründe.',
    fr: 'Chats ou chiens ? Défends ta réponse.',
    it: 'Gatti o cani? Difendi la tua risposta.',
  },
  {
    en: "What's a dealbreaker for you?",
    de: 'Was ist für dich ein Dealbreaker?',
    fr: 'Qu’est-ce qui est rédhibitoire pour toi ?',
    it: 'Qual è un dealbreaker per te?',
  },
  {
    en: 'What would your ex say about you?',
    de: 'Was würde dein Ex über dich sagen?',
    fr: 'Que dirait ton ex de toi ?',
    it: 'Cosa direbbe di te la tua ex o il tuo ex?',
  },
  {
    en: "What's your biggest ick?",
    de: 'Was törnt dich sofort ab?',
    fr: 'Qu’est-ce qui te refroidit direct ?',
    it: 'Cosa ti fa passare subito la voglia?',
  },
  {
    en: 'What are you irrationally scared of?',
    de: 'Wovor hast du grundlos Angst?',
    fr: 'De quoi as-tu peur sans raison ?',
    it: 'Di cosa hai una paura irrazionale?',
  },
  {
    en: "What's the best advice you've ever ignored?",
    de: 'Welchen guten Rat hast du trotzdem ignoriert?',
    fr: 'Quel est le meilleur conseil que tu as ignoré ?',
    it: 'Qual è il miglior consiglio che hai ignorato?',
  },
  {
    en: 'What would we do on our first date?',
    de: 'Was machen wir an unserem ersten Date?',
    fr: 'Qu’est-ce qu’on fait à notre premier rendez-vous ?',
    it: 'Cosa facciamo al nostro primo appuntamento?',
  },
  {
    en: "What's your love language?",
    de: 'Was ist deine Love Language?',
    fr: 'Quel est ton langage de l’amour ?',
    it: 'Qual è il tuo linguaggio dell’amore?',
  },
  {
    en: "What's a hill you'd die on?",
    de: 'Bei welchem Thema gibst du nie nach?',
    fr: 'Sur quel sujet tu ne lâches jamais ?',
    it: 'Su cosa non cedi mai?',
  },
  {
    en: 'What do people get wrong about you at first?',
    de: 'Was denken Leute zuerst falsch über dich?',
    fr: 'Sur quoi les gens se trompent à ton sujet au début ?',
    it: 'Cosa sbagliano le persone su di te all’inizio?',
  },
  {
    en: "What's the last thing that made you really excited?",
    de: 'Worauf hast du dich zuletzt richtig gefreut?',
    fr: 'Qu’est-ce qui t’a donné envie de sauter de joie dernièrement ?',
    it: 'Qual è l’ultima cosa che ti ha davvero entusiasmato?',
  },
  {
    en: 'Where would you go if you could leave tomorrow?',
    de: 'Wohin würdest du morgen abreisen, wenn du könntest?',
    fr: 'Où partirais-tu demain si tu pouvais ?',
    it: 'Dove andresti domani, se potessi?',
  },
  {
    en: 'Which emoji do you use the most?',
    de: 'Welches Emoji brauchst du am meisten?',
    fr: 'Quel emoji utilises-tu le plus ?',
    it: 'Qual è l’emoji che usi di più?',
  },
  {
    en: "What's a small thing that makes your day?",
    de: 'Welche Kleinigkeit macht deinen Tag?',
    fr: 'Quel petit truc fait ta journée ?',
    it: 'Quale piccola cosa ti migliora la giornata?',
  },
  {
    en: "What's the worst date you've ever been on?",
    de: 'Was war dein schlimmstes Date?',
    fr: 'Quel est le pire rendez-vous de ta vie ?',
    it: 'Qual è stato il tuo appuntamento peggiore?',
  },
  {
    en: 'What are you proud of but never get to brag about?',
    de: 'Worauf bist du stolz, kannst aber nie damit angeben?',
    fr: 'Quelle réussite gardes-tu pour toi ?',
    it: 'Di quale tuo successo non parli mai?',
  },
  {
    en: "What's your Sunday-morning breakfast?",
    de: 'Was gibt’s bei dir am Sonntag zum Zmorge?',
    fr: 'Qu’est-ce que tu manges le dimanche matin ?',
    it: 'Cosa mangi la domenica a colazione?',
  },
  {
    en: 'Mountains or lake? Convince me.',
    de: 'Berge oder See? Überzeug mich.',
    fr: 'Montagne ou lac ? Convaincs-moi.',
    it: 'Montagna o lago? Convincimi.',
  },
  {
    en: "What's the most useless thing you've ever spent money on?",
    de: 'Wofür hast du am meisten Geld verschwendet?',
    fr: 'Quel est ton achat le plus inutile ?',
    it: 'Qual è l’acquisto più inutile che hai fatto?',
  },
  {
    en: 'What would you never do on a first date?',
    de: 'Was würdest du an einem ersten Date nie machen?',
    fr: 'Que ne ferais-tu jamais à un premier rendez-vous ?',
    it: 'Cosa non faresti mai a un primo appuntamento?',
  },
  {
    en: "What's your toxic trait?",
    de: 'Was ist dein Toxic Trait?',
    fr: 'Quel est ton trait toxique ?',
    it: 'Qual è il tuo lato tossico?',
  },
  {
    en: 'Which show could you watch forever?',
    de: 'Welche Serie könntest du ewig schauen?',
    fr: 'Quelle série pourrais-tu regarder en boucle ?',
    it: 'Quale serie potresti guardare all’infinito?',
  },
  {
    en: "What's something you changed your mind about recently?",
    de: 'Wozu hast du kürzlich deine Meinung geändert?',
    fr: 'Sur quoi as-tu changé d’avis récemment ?',
    it: 'Su cosa hai cambiato idea di recente?',
  },
  {
    en: "What's your most unpopular opinion?",
    de: 'Was ist deine unpopulärste Meinung?',
    fr: 'Quelle est ton opinion la plus impopulaire ?',
    it: 'Qual è la tua opinione più impopolare?',
  },
  {
    en: 'Who in your life would I have to impress first?',
    de: 'Wen in deinem Leben müsste ich zuerst beeindrucken?',
    fr: 'Qui devrais-je impressionner en premier dans ta vie ?',
    it: 'Chi della tua vita dovrei conquistare per primo?',
  },
  {
    en: "What's the last text that made you smile?",
    de: 'Welche Nachricht hat dich zuletzt zum Lächeln gebracht?',
    fr: 'Quel est le dernier message qui t’a fait sourire ?',
    it: 'Qual è l’ultimo messaggio che ti ha fatto sorridere?',
  },
  {
    en: "What do you do when you can't sleep?",
    de: 'Was machst du, wenn du nicht schlafen kannst?',
    fr: 'Que fais-tu quand tu n’arrives pas à dormir ?',
    it: 'Cosa fai quando non riesci a dormire?',
  },
  {
    en: 'What skill do you wish you had?',
    de: 'Was würdest du gern können?',
    fr: 'Quelle compétence aimerais-tu avoir ?',
    it: 'Quale abilità vorresti avere?',
  },
  {
    en: 'What makes you trust someone right away?',
    de: 'Wann vertraust du jemandem sofort?',
    fr: 'Qu’est-ce qui te fait faire confiance à quelqu’un tout de suite ?',
    it: 'Cosa ti fa fidare subito di qualcuno?',
  },
];

/** The English texts, as the server stores them. */
export const QUESTION_TEXTS: readonly string[] = QUESTIONS.map((question) => question.en);

const byEnglish = new Map(QUESTIONS.map((question) => [question.en, question]));

/** A question in the reader's language, or as written when it isn't in the list. */
export function localizeQuestion(text: string, language: QuestionLanguage): string {
  return byEnglish.get(text)?.[language] ?? text;
}
