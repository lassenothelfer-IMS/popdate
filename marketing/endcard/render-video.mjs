// Renders index.html frame by frame in headless Chromium and encodes an H.264 MP4 with sound.wav.
// `node render-video.mjs --stills 0.1 1.2 4` writes only those moments as PNGs to check the look.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { openPage } from './serve.mjs';

const FPS = 30;
const SECONDS = 6;
const OUT = 'out/popdate-stitch-endcard.mp4';

const stillsAt = process.argv.includes('--stills') ? process.argv.slice(process.argv.indexOf('--stills') + 1).map(Number) : null;
const { page, close } = await openPage('index.html', { width: 1080, height: 1920 });

if (stillsAt) {
  mkdirSync('out/stills', { recursive: true });
  for (const t of stillsAt) {
    await page.evaluate((s) => window.renderAt(s), t);
    await page.screenshot({ path: `out/stills/t${t.toFixed(2)}.png` });
    console.log(`out/stills/t${t.toFixed(2)}.png`);
  }
  await close();
  process.exit(0);
}

const encoder = spawn(ffmpeg, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-i', 'out/sound.wav',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const frames = FPS * SECONDS;
for (let f = 0; f < frames; f++) {
  await page.evaluate((s) => window.renderAt(s), f / FPS);
  const png = await page.screenshot({ type: 'png' });
  if (!encoder.stdin.write(png)) await new Promise((resolve) => encoder.stdin.once('drain', resolve));
  if (f % 30 === 0) console.log(`frame ${f}/${frames}`);
}
encoder.stdin.end();
await new Promise((resolve, reject) => encoder.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
await close();
console.log(OUT);
