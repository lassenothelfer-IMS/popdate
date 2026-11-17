// Writes the narrator lines for Part 1 to voice/*.wav with Kokoro, a free text-to-speech model that
// runs locally (Apache-2.0, fine for commercial use). The first run downloads the model (~90 MB).
//   node voice.mjs                     the lines in the chosen voice (VOICE below)
//   node voice.mjs --voice am_fenrir   the lines in another voice
//   node voice.mjs --samples           one test sentence in every candidate voice, to out/voice-samples/
// After a new voice, put the printed lengths into PART1.narration in quiet-one-timeline.js, so the
// captions keep up with the words.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { KokoroTTS } from 'kokoro-js';
import { PART1 } from './quiet-one-timeline.js';

const VOICE = 'af_heart';
const SPEED = 0.95;
const CANDIDATES = ['af_heart', 'af_bella', 'af_nicole', 'bf_emma', 'am_fenrir', 'am_michael', 'am_puck', 'bm_george'];

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const voice = arg('--voice') ?? VOICE;
const speed = Number(arg('--speed') ?? SPEED);

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });

/** Speaks `text` and writes it as 48 kHz 16-bit mono, the format sound.mjs reads, without leading or trailing silence. */
async function speak(text, file, as = voice) {
  const raw = `${file}.raw.wav`;
  await (await tts.generate(text, { voice: as, speed })).save(raw);
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';
  spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-af', trim, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', file]);
  rmSync(raw);
  const probe = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return Number(probe[3]) + 60 * Number(probe[2]);
}

if (process.argv.includes('--samples')) {
  mkdirSync('out/voice-samples', { recursive: true });
  const text = `${PART1.narration[0][2]} ${PART1.narration[3][2]}`;
  for (const v of CANDIDATES) console.log(v, (await speak(text, `out/voice-samples/${v}.wav`, v)).toFixed(2), 's');
} else {
  mkdirSync('voice', { recursive: true });
  for (const [start, , text, file] of PART1.narration) {
    console.log(`[${start}, ${(await speak(text, `voice/${file}.wav`)).toFixed(2)}, '${text}', '${file}'],`);
  }
}
