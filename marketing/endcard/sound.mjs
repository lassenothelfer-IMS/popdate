// Synthesizes the end card's sound to out/sound.wav: every sample is generated here, so there is
// nothing to license. Cues line up with index.html: pop at 0, the question, a riser into the
// balloon at 2.25, the logo hit at 3.05, sparks at 3.3, the call to action at 4.05, and the
// balloon straining from 5.05 until a hard cut at 6, so the loop lands on the show clip's pop.
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 48000;
const SECONDS = 6;
const N = RATE * SECONDS;
const dry = [new Float32Array(N), new Float32Array(N)];
const wet = [new Float32Array(N), new Float32Array(N)];

let seed = 1;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
const at = (s) => Math.floor(s * RATE);

/** Adds `fn(time since start)` to both channels from `start` for `length` seconds. */
function add(start, length, fn, { gain = 1, pan = 0, send = 0.2 } = {}) {
  const l = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const r = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = at(start), end = Math.min(N, at(start + length)); i < end; i++) {
    const v = fn((i - at(start)) / RATE);
    dry[0][i] += v * l; dry[1][i] += v * r;
    wet[0][i] += v * l * send; wet[1][i] += v * r * send;
  }
}

const tone = (freq, t, detune = 0) => Math.sin(2 * Math.PI * freq * (1 + detune) * t);
const env = (t, attack, length, release) =>
  Math.min(1, t / attack) * (t > length - release ? Math.max(0, (length - t) / release) : 1);

// The pop: a bright crack of noise, a click, and a low thump that drops in pitch.
let lp = 0;
add(0, 0.5, (t) => {
  const n = noise();
  lp += 0.35 * (n - lp);
  return (n - lp) * Math.exp(-t / 0.03) * 0.9 + n * Math.exp(-t / 0.004) * 0.6;
}, { send: 0.45 });
add(0, 0.5, (t) => Math.sin(2 * Math.PI * (45 * t + (95 / 9) * (1 - Math.exp(-9 * t)) * 10)) * Math.exp(-t / 0.09) * 0.8, { send: 0.1 });

// Suspense: a soft A minor 9 pad under the question.
for (const [freq, pan] of [[110, -0.2], [164.81, 0.25], [261.63, -0.35], [392, 0.35], [493.88, 0]]) {
  add(0.15, 2.35, (t) => {
    const e = env(t, 0.6, 2.35, 0.4);
    return e * (tone(freq, t, -0.003) + tone(freq, t, 0.003) + 0.25 * tone(freq * 2, t)) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 3 * t));
  }, { gain: 0.035, pan, send: 0.5 });
}

// A heartbeat while the question sits there.
for (const [time, gain] of [[0.7, 0.55], [0.88, 0.35], [1.45, 0.6], [1.63, 0.4]]) {
  add(time, 0.3, (t) => tone(58 - 20 * t, t) * Math.exp(-t / 0.07), { gain, send: 0.05 });
}

// Riser into the balloon: filtered noise opening up and a glide.
let rlp = 0;
add(1.65, 0.62, (t) => {
  const p = t / 0.62;
  rlp += (0.02 + 0.5 * p * p) * (noise() - rlp);
  return rlp * p * p * 0.9 + Math.sin(2 * Math.PI * (180 * t + 700 * t * p)) * p * p * 0.06;
}, { send: 0.3 });

// The balloon's lift: a soft whoosh peaking as it rises past the middle.
let wlp = 0;
add(2.2, 0.9, (t) => {
  wlp += 0.08 * (noise() - wlp);
  return wlp * Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 2 * 1.4;
}, { send: 0.35 });

// The logo hit: a sub drop, a bell chord in C, and a warm F major 7 pad to the end.
add(3.05, 1.6, (t) => tone(55, t) * Math.exp(-t / 0.35), { gain: 0.6, send: 0.1 });
for (const [freq, pan] of [[523.25, -0.3], [659.25, 0.3], [783.99, -0.15], [1174.66, 0.15]]) {
  add(3.05, 2.95, (t) => {
    const strike = Math.min(1, t / 0.004);
    return strike * Math.exp(-t / 1.1) * (tone(freq, t) + 0.3 * tone(freq * 2.01, t) * Math.exp(-t / 0.3) + 0.1 * tone(freq * 3.02, t) * Math.exp(-t / 0.15));
  }, { gain: 0.07, pan, send: 0.55 });
}
for (const [freq, pan] of [[87.31, 0], [130.81, -0.25], [220, 0.25], [329.63, -0.3], [523.25, 0.3]]) {
  add(3.05, 2.95, (t) => env(t, 0.35, 2.95, 0.7) * (tone(freq, t, -0.002) + tone(freq, t, 0.002)), { gain: 0.03, pan, send: 0.5 });
}

// Sparks: three tiny ticks, left to right.
[3.3, 3.34, 3.38].forEach((time, i) => add(time, 0.08, (t) => tone(3200 + i * 400, t) * Math.exp(-t / 0.008), { gain: 0.12, pan: -0.3 + i * 0.3, send: 0.4 }));

// The call to action: one soft pluck.
add(4.05, 1, (t) => tone(783.99, t) * Math.exp(-t / 0.25) * Math.min(1, t / 0.003), { gain: 0.1, send: 0.5 });

// The strain: a rubbery squeak climbing in pitch with a wobble, over hiss that opens up.
let sphase = 0, shp = 0, sprev = 0;
add(5.05, 0.95, (t) => {
  const p = t / 0.95;
  const freq = (380 + 520 * p * p) * (1 + 0.035 * Math.sin(2 * Math.PI * 23 * t));
  sphase += (2 * Math.PI * freq) / RATE;
  const n = noise();
  shp = 0.7 * (shp + n - sprev);
  sprev = n;
  return Math.tanh(2.5 * Math.sin(sphase)) * p * p * 0.22 + shp * p ** 3 * 0.12;
}, { send: 0.25 });

// A small Freeverb-style room on the send bus.
function reverb(input, offset) {
  const out = new Float32Array(N);
  for (const delay of [1557, 1617, 1491, 1422].map((d) => d + offset)) {
    const buf = new Float32Array(delay);
    let idx = 0, damp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      damp = y * 0.6 + damp * 0.4;
      buf[idx] = input[i] + damp * 0.82;
      idx = (idx + 1) % delay;
      out[i] += y * 0.25;
    }
  }
  for (const delay of [556, 441].map((d) => d + offset)) {
    const buf = new Float32Array(delay);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[idx];
      buf[idx] = out[i] + b * 0.5;
      out[i] = b - out[i];
      idx = (idx + 1) % delay;
    }
  }
  return out;
}
const room = [reverb(wet[0], 0), reverb(wet[1], 23)];

const mixL = new Float32Array(N), mixR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  // Only a few milliseconds of fade: the end is meant to be a cut, just without a click.
  const fade = Math.min(1, (N - i) / at(0.012));
  mixL[i] = (dry[0][i] + room[0][i] * 0.6) * fade;
  mixR[i] = (dry[1][i] + room[1][i] * 0.6) * fade;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
// About -15 LUFS, close to what TikTok plays clips at; tanh below rounds off the pop's peak.
const norm = (0.89 / peak) * 2.6;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.tanh(mixL[i] * norm) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.tanh(mixR[i] * norm) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
mkdirSync('out', { recursive: true });
writeFileSync('out/sound.wav', Buffer.concat([header, data]));
console.log('out/sound.wav');
