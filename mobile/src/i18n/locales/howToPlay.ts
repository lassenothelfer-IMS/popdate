import type { Strings } from '@/i18n/types';

/** Strings for this area of the app, in every supported language. English is the source. */
export const howToPlay = {
  en: {
    title: 'How to play',
    stepLabel: 'Step %{number} of %{total}: %{text}',
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
    stepLabel: 'Schritt %{number} von %{total}: %{text}',
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
    stepLabel: 'Étape %{number} sur %{total} : %{text}',
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
    stepLabel: 'Passo %{number} di %{total}: %{text}',
    roundOf: 'Round %{round} di %{total}',
    choosingTitle: 'Se sei tu a scegliere',
    choosingBody:
      'A ogni round fai una domanda, leggi le risposte e fai scoppiare un palloncino. Tieni per ultima la persona che ti piace di più.',
    balloonTitle: 'Se tieni un palloncino',
    balloonBody:
      'Rispondi come sei. Prima contano le tue parole, poi arrivano le foto, un round alla volta.',
    gotIt: 'Ho capito',
  },
} satisfies Strings;
