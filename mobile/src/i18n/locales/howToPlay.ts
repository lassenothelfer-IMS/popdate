import type { Strings } from '@/i18n/types';

/** Strings for this area of the app, in every supported language. English is the source. */
export const howToPlay: Strings = {
  en: {
    title: 'How to play',
    step1: 'One person chooses, and five hold balloons.',
    step2: 'Everyone answers the same question.',
    step3: 'Each round, one more photo appears and one balloon pops.',
    step4: 'The last balloon left is the match.',
    stepLabel: 'Step %{number} of %{total}: %{text}',
    sampleQuestion: "What's your idea of a perfect Sunday?",
    roundOf: 'Round %{round} of %{total}',
    choosingTitle: "If you're choosing",
    choosingBody:
      'Ask a question each round, read the answers, and pop one balloon. Keep the one you like most for last.',
    balloonTitle: 'If you hold a balloon',
    balloonBody:
      'Answer like yourself. Your words come first, and your photos follow one round at a time.',
    gotIt: 'Got it',
  },
  de: {
    title: 'So wird gespielt',
    step1: 'Eine Person wählt, fünf halten Ballone.',
    step2: 'Alle beantworten dieselbe Frage.',
    step3: 'Jede Runde erscheint ein weiteres Foto, und ein Ballon platzt.',
    step4: 'Der letzte Ballon, der übrig bleibt, ist das Match.',
    stepLabel: 'Schritt %{number} von %{total}: %{text}',
    sampleQuestion: 'Wie sieht dein perfekter Sonntag aus?',
    roundOf: 'Runde %{round} von %{total}',
    choosingTitle: 'Wenn du wählst',
    choosingBody:
      'Stell jede Runde eine Frage, lies die Antworten und lass einen Ballon platzen. Wen du am meisten magst, behältst du bis zum Schluss.',
    balloonTitle: 'Wenn du einen Ballon hältst',
    balloonBody:
      'Antworte so, wie du bist. Zuerst zählen deine Worte, deine Fotos folgen Runde für Runde.',
    gotIt: 'Alles klar',
  },
  fr: {
    title: 'Comment jouer',
    step1: 'Une personne choisit, cinq tiennent un ballon.',
    step2: 'Tout le monde répond à la même question.',
    step3: 'À chaque manche, une photo de plus apparaît et un ballon éclate.',
    step4: "Le dernier ballon qui reste, c'est le match.",
    stepLabel: 'Étape %{number} sur %{total} : %{text}',
    // A no-break space keeps the question mark on the word's line.
    sampleQuestion: 'À quoi ressemble ton dimanche idéal ?',
    roundOf: 'Manche %{round} sur %{total}',
    choosingTitle: 'Si tu choisis',
    choosingBody:
      'Pose une question à chaque manche, lis les réponses et fais éclater un ballon. Garde pour la fin la personne qui te plaît le plus.',
    balloonTitle: 'Si tu tiens un ballon',
    balloonBody:
      'Réponds comme tu es. Tes mots passent en premier, tes photos suivent manche après manche.',
    gotIt: 'Compris',
  },
  it: {
    title: 'Come si gioca',
    step1: 'Una persona sceglie, cinque tengono un palloncino.',
    step2: 'Tutti rispondono alla stessa domanda.',
    step3: 'A ogni round appare una foto in più e scoppia un palloncino.',
    step4: "L'ultimo palloncino rimasto è il match.",
    stepLabel: 'Passo %{number} di %{total}: %{text}',
    sampleQuestion: "Com'è la tua domenica perfetta?",
    roundOf: 'Round %{round} di %{total}',
    choosingTitle: 'Se sei tu a scegliere',
    choosingBody:
      'A ogni round fai una domanda, leggi le risposte e fai scoppiare un palloncino. Tieni per ultima la persona che ti piace di più.',
    balloonTitle: 'Se tieni un palloncino',
    balloonBody:
      'Rispondi come sei. Prima contano le tue parole, poi arrivano le foto, un round alla volta.',
    gotIt: 'Ho capito',
  },
};
