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

export const LABELS = [[0, 'ROUND 1'], [POPS.D + 0.6, 'ROUND 2'], [POPS.A + 0.45, 'ROUND 3'], [T.round4, 'ROUND 4'], [T.match, 'MATCH']];
