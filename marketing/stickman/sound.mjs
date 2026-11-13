// Synthesizes the sound for "The quiet one": every sample is generated here, so there is nothing
// to license. Writes two tracks:
//   out/quiet-one-mix.wav  music bed (96 BPM, the beat drops in at the reveal, pops on the beat,
//                          silence before the last pop) + effects
//   out/quiet-one-sfx.wav  effects only, for posting with a trending song added in Instagram
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BEAT, DURATION, T, POPS, FLIGHT, LABELS, PART1 } from './quiet-one-timeline.js';

// `--part 1` makes the sound for Part 1 of the series: longer, with the cliffhanger and a voice track.
const PART = process.argv.includes('--part') ? process.argv[process.argv.indexOf('--part') + 1] : null;
const LENGTH = PART === '1' ? PART1.end : DURATION;
const BASE = PART ? `out/quiet-one-part${PART}` : 'out/quiet-one';

const RATE = 48000;
const N = Math.round(RATE * LENGTH);
const bus = () => ({ dry: [new Float32Array(N), new Float32Array(N)], wet: [new Float32Array(N), new Float32Array(N)] });
const music = bus(), sfx = bus();

let seed = 1;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
const at = (s) => Math.floor(s * RATE);
const tone = (freq, t) => Math.sin(2 * Math.PI * freq * t);
const env = (t, attack, length, release) => Math.min(1, t / attack) * (t > length - release ? Math.max(0, (length - t) / release) : 1);

/** Adds `fn(time since start)` to a bus from `start` for `length` seconds. */
function add(target, start, length, fn, { gain = 1, pan = 0, send = 0.2 } = {}) {
  const l = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const r = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = Math.max(0, at(start)), end = Math.min(N, at(start + length)); i < end; i++) {
    const v = fn((i - at(start)) / RATE);
    target.dry[0][i] += v * l; target.dry[1][i] += v * r;
    target.wet[0][i] += v * l * send; target.wet[1][i] += v * r * send;
  }
}
const b = (beat) => beat * BEAT;
const NOTE = { A1: 55, C2: 65.41, F1: 43.65, G1: 49, A3: 220, C4: 261.63, E4: 329.63, F3: 174.61, G3: 196, B3: 246.94, D4: 293.66, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, D6: 1174.66 };

// ---------------------------------------------------------------- music bed

// Beats where the song changes: a sparse groove while they answer and he types, the full beat
// when his answer appears, silence before the last pop, then the payoff.
const REVEAL = 16, SILENCE = 30, LAST_POP = 31, END = PART ? 38 : 36;

const CHORDS = [
  [0, 4, NOTE.A1, [NOTE.A3, NOTE.C4, NOTE.E4]],
  [4, 4, NOTE.F1, [NOTE.F3, NOTE.A3, NOTE.C4]],
  [8, 4, NOTE.C2, [NOTE.G3, NOTE.C4, NOTE.E4]],
  [12, 4, NOTE.G1, [NOTE.G3, NOTE.B3, NOTE.D4]],
  [16, 4, NOTE.A1, [NOTE.A3, NOTE.C4, NOTE.E4]],
  [20, 4, NOTE.F1, [NOTE.F3, NOTE.A3, NOTE.C4]],
  [24, 4, NOTE.C2, [NOTE.G3, NOTE.C4, NOTE.E4]],
  [28, 2, NOTE.G1, [NOTE.G3, NOTE.B3, NOTE.D4]],
  [31, 2, NOTE.F1, [NOTE.F3, NOTE.A3, NOTE.C4]],
  [33, END - 33, NOTE.C2, [NOTE.G3, NOTE.C4, NOTE.E4]],
];

for (const [start, beats, root, triad] of CHORDS) {
  const len = b(beats) + 0.05;
  // A soft, slightly detuned pad.
  triad.forEach((freq, i) => add(music, b(start), len, (t) => {
    const e = env(t, 0.25, len, 0.2);
    return e * (tone(freq * 0.997, t) + tone(freq * 1.003, t) + 0.3 * tone(freq * 2, t)) * (0.9 + 0.1 * Math.sin(2 * Math.PI * 0.5 * t));
  }, { gain: 0.028, pan: (i - 1) * 0.4, send: 0.6 }));
  // Bass: long notes before the reveal, then a pluck on every beat.
  if (start < REVEAL) {
    add(music, b(start), len, (t) => env(t, 0.08, len, 0.15) * Math.tanh(1.6 * tone(root, t)), { gain: 0.3, send: 0.05 });
  } else {
    for (let k = 0; k < beats; k++) {
      add(music, b(start + k), BEAT, (t) => Math.exp(-t / 0.3) * Math.min(1, t / 0.004) * Math.tanh(2 * tone(root, t) + 0.4 * tone(root * 2, t)), { gain: 0.36, send: 0.05 });
    }
  }
}

// A plucked arpeggio from the reveal until the silence.
for (let half = REVEAL * 2; half < SILENCE * 2; half++) {
  const beat = half / 2, k = half - REVEAL * 2;
  const triad = CHORDS.find(([s, n]) => beat >= s && beat < s + n)[3];
  const freq = triad[[0, 1, 2, 1][k % 4]] * 2;
  add(music, b(beat), 0.4, (t) => Math.exp(-t / 0.12) * Math.min(1, t / 0.002) * (tone(freq, t) + 0.25 * tone(freq * 2, t)), { gain: 0.05, pan: k % 2 ? 0.35 : -0.35, send: 0.45 });
}

// Drums: a kick every other beat before the reveal, every beat after, nothing in the silence.
const kick = (beat, gain = 0.85) => add(music, b(beat), 0.4, (t) => tone(45 + 85 * Math.exp(-t / 0.03), t) * Math.exp(-t / 0.2), { gain, send: 0.05 });
const clap = (beat) => {
  let lp = 0;
  add(music, b(beat), 0.25, (t) => {
    const n = noise();
    lp += 0.45 * (n - lp);
    return (n - lp) * (Math.exp(-t / 0.05) + 0.6 * Math.exp(-Math.abs(t - 0.012) / 0.006));
  }, { gain: 0.32, send: 0.35 });
};
const hat = (beat, gain) => {
  let prev = 0;
  add(music, b(beat), 0.06, (t) => { const n = noise(), v = n - prev; prev = n; return v * Math.exp(-t / 0.018); }, { gain, pan: 0.25, send: 0.1 });
};
for (let beat = 0; beat < END; beat++) {
  if (beat >= SILENCE && beat < LAST_POP) continue;
  if (beat >= REVEAL || beat % 2 === 0) kick(beat, beat >= LAST_POP ? 1 : beat >= REVEAL ? 0.85 : 0.6);
  if (beat > REVEAL && beat % 2 === 1 && beat < END - 1) clap(beat);
}
for (let half = 8; half < END * 2 - 1; half++) {
  const beat = half / 2;
  if (beat >= SILENCE && beat < LAST_POP) continue;
  hat(beat, (half % 2 ? 0.09 : 0.05) * (beat < REVEAL ? 0.6 : 1));
}

// ---------------------------------------------------------------- effects

function whoosh(start, length, gain, panFrom, panTo) {
  let lp = 0;
  const steps = 8;
  for (let s = 0; s < steps; s++) {
    const p0 = s / steps;
    add(sfx, start + p0 * length, length / steps, (t) => {
      const p = p0 + t / length;
      lp += (0.03 + 0.25 * Math.sin(Math.PI * p)) * (noise() - lp);
      return lp * Math.sin(Math.PI * p) ** 2 * 2;
    }, { gain, pan: panFrom + (panTo - panFrom) * p0, send: 0.3 });
  }
}

function pop(time, big) {
  let lp = 0;
  add(sfx, time, 0.6, (t) => {
    const n = noise();
    lp += 0.35 * (n - lp);
    return (n - lp) * Math.exp(-t / (big ? 0.045 : 0.03)) * 0.9 + n * Math.exp(-t / 0.004) * 0.6;
  }, { gain: big ? 1.1 : 0.85, send: 0.45 });
  add(sfx, time, big ? 1.2 : 0.5, (t) => tone(40 + 70 * Math.exp(-t / 0.04), t) * Math.exp(-t / (big ? 0.35 : 0.1)), { gain: big ? 1 : 0.6, send: 0.1 });
}

// The question card going up, each answer popping in, his growing bubble, and the heckling.
whoosh(T.cardUp - 0.05, 0.35, 0.5, 0.3, 0.5);
const blip = (time, from, gain, pan) => add(sfx, time, 0.12, (t) => tone(from + 5000 * t, t) * Math.exp(-t / 0.04), { gain, pan, send: 0.3 });
const SPOT = { A: -0.35, B: -0.05, C: 0.35, D: 0.75 };
for (const [id, time] of T.answers) blip(time, 500, 0.18, SPOT[id]);
blip(T.quietTurn, 420, 0.16, -0.7);
for (const [id, time] of T.mocks) blip(time, 650, 0.14, SPOT[id]);

// His typing: soft, uneven key clicks until the answer appears.
{
  let r = 3;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let time = T.quietTurn + 0.15; time < T.reveal - 0.05; time += 0.05 + rand() * 0.08) {
    let prev = 0;
    add(sfx, time, 0.03, (t) => { const n = noise(), v = n - prev; prev = n; return v * Math.exp(-t / 0.006); }, { gain: 0.1 + rand() * 0.06, pan: -0.7, send: 0.15 });
  }
}
// The reveal: two bright plucks going up.
[[NOTE.E5, 0], [NOTE.A4 * 2, 0.09]].forEach(([freq, delay]) => add(sfx, T.reveal + delay, 0.8, (t) => (tone(freq, t) + 0.3 * tone(freq * 2, t)) * Math.exp(-t / 0.25) * Math.min(1, t / 0.003), { gain: 0.1, pan: -0.5, send: 0.5 }));
whoosh(T.cardDown, 0.25, 0.3, 0.5, 0.3);

// Each throw, each pop, each new round.
const PAN = { D: 0.75, A: -0.35, C: 0.35, B: -0.05 };
for (const [id, time] of Object.entries(POPS)) {
  whoosh(time - FLIGHT, FLIGHT, 0.55, 0.5, PAN[id]);
  pop(time, id === 'B');
}
for (const [time] of LABELS.slice(1, 4)) add(sfx, time, 0.1, (t) => tone(2200, t) * Math.exp(-t / 0.02), { gain: 0.08, send: 0.3 });

// Round 4: a pin glint each time she re-aims, and a heartbeat that speeds up.
for (const [time, who] of T.aims) {
  add(sfx, time + 0.2, 0.6, (t) => (tone(2637, t) + 0.5 * tone(3951, t) * Math.exp(-t / 0.1)) * Math.exp(-t / 0.25) * Math.min(1, t / 0.002), { gain: 0.07, pan: who === 'B' ? 0 : -0.6, send: 0.5 });
}
for (let time = T.aims[0][0], gap = 0.62; time < POPS.B - 0.15; time += gap, gap = Math.max(0.42, gap * 0.94)) {
  for (const [offset, gain] of [[0, 0.7], [0.15, 0.45]]) add(sfx, time + offset, 0.25, (t) => tone(55 - 18 * t, t) * Math.exp(-t / 0.07), { gain, send: 0.05 });
}

// The lift: an airy swell with rising chimes, then a soft landing.
{
  let lp = 0;
  const len = T.land - T.lift;
  add(sfx, T.lift, len, (t) => { lp += 0.05 * (noise() - lp); return lp * Math.sin((Math.PI * t) / len) ** 2 * 1.6; }, { gain: 0.5, send: 0.5 });
  const scale = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C5 * 2, NOTE.E5 * 2, NOTE.G5 * 2];
  for (let k = 0; k < 12; k++) {
    const freq = scale[k % scale.length];
    add(sfx, T.lift + 0.15 + k * 0.15, 0.9, (t) => tone(freq, t) * Math.exp(-t / 0.3) * Math.min(1, t / 0.003), { gain: 0.045, pan: Math.sin(k) * 0.6, send: 0.7 });
  }
  add(sfx, T.land, 0.3, (t) => tone(70 - 30 * t, t) * Math.exp(-t / 0.08), { gain: 0.5, send: 0.1 });
}

// The match: a bell chord.
for (const [freq, pan] of [[NOTE.C5, -0.3], [NOTE.E5, 0.3], [NOTE.G5, -0.15], [NOTE.D6, 0.15]]) {
  add(sfx, T.match, LENGTH - T.match, (t) => Math.min(1, t / 0.004) * Math.exp(-t / 1.1) * (tone(freq, t) + 0.3 * tone(freq * 2.01, t) * Math.exp(-t / 0.3)), { gain: 0.08, pan, send: 0.6 });
}

// ---------------------------------------------------------------- Part 1: the cliffhanger

if (PART === '1') {
  // A low drone of two clashing notes while the camera finds Brick.
  const drone = PART1.cut - PART1.turn;
  for (const [freq, pan] of [[55, -0.2], [58.27, 0.2], [110, 0], [116.54, 0]]) {
    add(sfx, PART1.turn, drone, (t) => env(t, 1.2, drone, 0.05) * Math.tanh(1.5 * tone(freq, t)), { gain: freq < 100 ? 0.22 : 0.06, pan, send: 0.4 });
  }
  for (const time of [PART1.turn + 0.9, PART1.turn + 1.6, PART1.turn + 2.3]) {
    for (const [offset, gain] of [[0, 0.7], [0.15, 0.45]]) add(sfx, time + offset, 0.25, (t) => tone(55 - 18 * t, t) * Math.exp(-t / 0.07), { gain, send: 0.05 });
  }
  // "this isn't over.": a low hit with a dissonant stab.
  add(sfx, PART1.threat, 1.2, (t) => tone(38 + 60 * Math.exp(-t / 0.05), t) * Math.exp(-t / 0.4), { gain: 0.9, send: 0.2 });
  for (const freq of [110, 116.54, 164.81]) {
    add(sfx, PART1.threat, 1, (t) => Math.tanh(3 * tone(freq, t)) * Math.exp(-t / 0.35) * Math.min(1, t / 0.005), { gain: 0.07, send: 0.5 });
  }
  // The cut to the app: one boom, a whoosh as the phone rises, and the beat comes back.
  add(sfx, PART1.cut, 1.8, (t) => tone(32 + 50 * Math.exp(-t / 0.06), t) * Math.exp(-t / 0.6), { gain: 1, send: 0.3 });
  whoosh(PART1.cut, 0.5, 0.5, 0, 0);
  for (const [time] of PART1.screens.slice(1)) whoosh(time - 0.05, 0.22, 0.25, 0.6, -0.2);
  const CUT = PART1.cut / BEAT, LAST = PART1.end / BEAT - 1;
  const OUTRO = [[NOTE.A1, CHORDS[0][3]], [NOTE.F1, CHORDS[1][3]], [NOTE.C2, CHORDS[2][3]], [NOTE.G1, CHORDS[3][3]]];
  for (let beat = CUT; beat < LAST + 1; beat += 2) {
    const [root, triad] = OUTRO[((beat - CUT) / 2) % 4];
    const len = b(beat === LAST ? 1 : 2) + (beat === LAST ? 1.5 : 0.05);
    triad.forEach((freq, i) => add(music, b(beat), len, (t) => env(t, 0.05, len, 0.2) * (tone(freq * 0.997, t) + tone(freq * 1.003, t) + 0.3 * tone(freq * 2, t)), { gain: 0.03, pan: (i - 1) * 0.4, send: 0.6 }));
    for (let k = 0; k < 2 && beat + k <= LAST; k++) {
      add(music, b(beat + k), BEAT, (t) => Math.exp(-t / 0.3) * Math.min(1, t / 0.004) * Math.tanh(2 * tone(root, t) + 0.4 * tone(root * 2, t)), { gain: 0.36, send: 0.05 });
      for (let h = 0; h < 2; h++) {
        const freq = triad[[0, 1, 2, 1][(k * 2 + h) % 4]] * 2;
        add(music, b(beat + k + h / 2), 0.4, (t) => Math.exp(-t / 0.12) * Math.min(1, t / 0.002) * (tone(freq, t) + 0.25 * tone(freq * 2, t)), { gain: 0.05, pan: h ? 0.35 : -0.35, send: 0.45 });
      }
    }
  }
  for (let beat = CUT; beat <= LAST; beat++) {
    kick(beat, beat === LAST ? 1 : 0.85);
    if (beat % 2 === 1 && beat < LAST) clap(beat);
    if (beat < LAST) { hat(beat, 0.05); hat(beat + 0.5, 0.09); }
  }
  // The call to action: two bright plucks going up, like his answer appearing.
  [[NOTE.E5, 0], [NOTE.A4 * 2, 0.09]].forEach(([freq, delay]) => add(sfx, PART1.cta + 0.45 + delay, 0.8, (t) => (tone(freq, t) + 0.3 * tone(freq * 2, t)) * Math.exp(-t / 0.25) * Math.min(1, t / 0.003), { gain: 0.1, send: 0.5 }));
}

// The narrator (voice/*.wav from voice.mjs), through the cliffhanger and the app at the end.
const voice = bus();
const talking = new Float32Array(N);
if (PART === '1') {
  for (const [start, , , file] of PART1.narration) {
    const wav = readFileSync(`voice/${file}.wav`);
    let pos = 12;
    while (wav.toString('ascii', pos, pos + 4) !== 'data') pos += 8 + wav.readUInt32LE(pos + 4);
    const size = wav.readUInt32LE(pos + 4), samples = size / 2;
    for (let k = 0; k < samples; k++) {
      const i = at(start) + k;
      if (i >= N) break;
      const v = wav.readInt16LE(pos + 8 + k * 2) / 32768;
      voice.dry[0][i] += v * 2; voice.dry[1][i] += v * 2;
      voice.wet[0][i] += v * 0.1; voice.wet[1][i] += v * 0.1;
      talking[i] = 1;
    }
  }
}
// Music dips under the voice, with soft 150 ms ramps.
const duck = new Float32Array(N);
{
  let level = 1;
  const step = 1 / at(0.15);
  for (let i = 0; i < N; i++) {
    level += Math.sign((talking[i] ? 0.4 : 1) - level) * step;
    duck[i] = level;
  }
}

// ---------------------------------------------------------------- mix down

// A small Freeverb-style room on each send bus.
function reverb(input, offset) {
  const out = new Float32Array(N);
  for (const delay of [1557, 1617, 1491, 1422].map((d) => d + offset)) {
    const buf = new Float32Array(delay);
    let idx = 0, damp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      damp = y * 0.6 + damp * 0.4;
      buf[idx] = input[i] + damp * 0.84;
      idx = (idx + 1) % delay;
      out[i] += y * 0.25;
    }
  }
  for (const delay of [556, 441].map((d) => d + offset)) {
    const buf = new Float32Array(delay);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      const v = buf[idx];
      buf[idx] = out[i] + v * 0.5;
      out[i] = v - out[i];
      idx = (idx + 1) % delay;
    }
  }
  return out;
}

function render(buses, file, targetRms) {
  const L = new Float32Array(N), R = new Float32Array(N);
  for (const { dry, wet, gain } of buses) {
    const room = [reverb(wet[0], 0), reverb(wet[1], 23)];
    for (let i = 0; i < N; i++) {
      const g = gain ? gain[i] : 1;
      L[i] += (dry[0][i] + room[0][i] * 0.6) * g; R[i] += (dry[1][i] + room[1][i] * 0.6) * g;
    }
  }
  let sum = 0;
  for (let i = 0; i < N; i++) sum += L[i] ** 2 + R[i] ** 2;
  const norm = targetRms / Math.sqrt(sum / (2 * N));
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    // A few milliseconds of fade at the end: the loop is a hard cut, just without a click.
    const fade = Math.min(1, (N - i) / at(0.012));
    data.writeInt16LE(Math.round(Math.tanh(L[i] * norm) * 0.8 * fade * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.tanh(R[i] * norm) * 0.8 * fade * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
  console.log(file);
}

mkdirSync('out', { recursive: true });
render([music, sfx], `${BASE}-mix.wav`, 0.24);
render([sfx], `${BASE}-sfx.wav`, 0.12);
if (PART === '1') render([{ ...music, gain: duck }, { ...sfx, gain: duck }, voice], `${BASE}-voice.wav`, 0.24);
