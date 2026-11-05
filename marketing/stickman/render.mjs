// Renders a scene (`<name>.html`) frame by frame in headless Chromium and encodes two H.264 MP4s:
// one with our music bed and one with sound effects only, for posting with a trending song.
// `node render.mjs quiet-one --stills 0.1 6.3 13` writes only those moments as PNGs to check the look.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { openPage } from './serve.mjs';

const FPS = 30;
const name = process.argv[2] ?? 'quiet-one';
const stillsAt = process.argv.includes('--stills') ? process.argv.slice(process.argv.indexOf('--stills') + 1).map(Number) : null;
const { page, close } = await openPage(`${name}.html`, { width: 1080, height: 1920 });
const seconds = await page.evaluate(() => window.DURATION);
mkdirSync('out', { recursive: true });

if (stillsAt) {
  mkdirSync('out/stills', { recursive: true });
  for (const t of stillsAt) {
    await page.evaluate((s) => window.renderAt(s), t);
    const path = `out/stills/${name}-t${t.toFixed(2)}.png`;
    await page.screenshot({ path });
    console.log(path);
  }
  await close();
  process.exit(0);
}

const silent = `out/${name}-silent.mp4`;
const encoder = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', silent,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((resolve, reject) => encoder.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));

const frames = Math.round(FPS * seconds);
for (let f = 0; f < frames; f++) {
  await page.evaluate((s) => window.renderAt(s), f / FPS);
  const png = await page.screenshot({ type: 'png' });
  if (!encoder.stdin.write(png)) await new Promise((resolve) => encoder.stdin.once('drain', resolve));
  if (f % 30 === 0) console.log(`frame ${f}/${frames}`);
}
encoder.stdin.end();
await done;
await close();

// Mux each sound track onto the picture.
for (const [track, out] of [[`out/${name}-mix.wav`, `out/${name}.mp4`], [`out/${name}-sfx.wav`, `out/${name}-sfx-only.mp4`]]) {
  await new Promise((resolve, reject) => {
    spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', silent, '-i', track, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' })
      .on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  console.log(out);
}
