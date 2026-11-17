// When things happen in "The quiet one". The scene and the sound both read this, so every pop
// lands on the music's beat (96 BPM).
export const BEAT = 60 / 96;
export const DURATION = 36 * BEAT; // 22.5 s

// Pops, always on a beat.
export const POPS = { D: 22 * BEAT, A: 24 * BEAT, C: 25.5 * BEAT, B: 31 * BEAT };
export const FLIGHT = 0.3; // seconds from the throw to the pop

export const T = {
  cardUp: 1.5, // the popper holds up the question
  cardHold: 3.0, // she lets go and the card floats above her
  // The four answer in turn, right to left, with a pause after each.
  answers: [['D', 3.2, 'lol'], ['C', 4.2, 'my mom’s lasagna'], ['B', 5.2, 'reservations'], ['A', 6.2, 'u']],
  quietTurn: 7.0, // his bubble appears and grows while he types, still empty
  laugh: 7.6, // the four start laughing at him; their answers go away
  // What they shout while he types.
  mocks: [['A', 7.9, 'bro’s writing a book'], ['D', 8.5, 'nerd'], ['C', 9.0, 'it’s dinner, not an essay'], ['B', 9.45, 'lmaooo']],
  reveal: 16 * BEAT, // 10 s: his answer appears, the heckling stops
  cardDown: 12.5, // question and answer go away
  round4: POPS.C + 0.5, // only the quiet one and the muscle guy are left
  silence: 30 * BEAT, // the music drops out
  lift: POPS.B + 0.225, // his balloon lifts him up
  land: POPS.B + 2.175, // he lands next to her
  match: 35 * BEAT,
};
// The pin hovers between the last two.
T.aims = [[T.round4 + 0.35, 'quiet'], [T.round4 + 1.0, 'B'], [T.round4 + 1.55, 'quiet'], [T.round4 + 2.0, 'B']];

// Part 1 of the series: the same Reel with a narrator and a cliffhanger after the match, then a
// hard cut to the real app on a phone and the waitlist.
// Each line: [start, seconds the voice takes, text, file in voice/]. `node voice.mjs` prints the lengths.
export const PART1 = {
  narration: [
    [0.2, 2.61, 'Every room has one guy nobody takes seriously.', 'line1'],
    [4.2, 1.89, 'Four of them had their answers ready.', 'line2'],
    [7.4, 1.13, 'He was still typing.', 'line3'],
    [19.8, 2.08, 'They laughed, until he was the last balloon.', 'line4'],
    [23.9, 1.29, 'But one of them wasn’t done.', 'line5'],
    // After the cut: the app. These aren't captioned, the big headline says the same.
    [27.85, 1.30, 'So we made it a real app.', 'line6'],
    [29.95, 1.79, 'Ask a question. Pop the rest.', 'line7'],
    [32.75, 2.17, 'Join the waitlist. Link in bio.', 'line8'],
  ],
  turn: 38 * BEAT, // the camera finds Brick; he turns to face us
  threat: 26.4, // "this isn't over."
  cut: 44 * BEAT, // hard cut to the app on a phone, the beat comes back
  screens: [[44 * BEAT, 'C01Pick'], [47 * BEAT, 'C03Listen'], [49 * BEAT, 'Pop'], [50.5 * BEAT, 'Match']],
  cta: 52 * BEAT, // "join the waitlist"
  end: 57 * BEAT,
};

export const LABELS =[[0, 'ROUND 1'], [POPS.D + 0.6, 'ROUND 2'], [POPS.A + 0.45, 'ROUND 3'], [T.round4, 'ROUND 4'], [T.match, 'MATCH']];
