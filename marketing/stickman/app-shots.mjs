// Screenshots app screens from the design mockups (design/screens/game-velvet) into app/, for the
// phone in the Reel's ending. `node app-shots.mjs Round Reveal Pop` picks which screens.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const screens = process.argv.slice(2).length ? process.argv.slice(2) : ['Round', 'Reveal', 'Pop', 'Match'];
const dir = fileURLToPath(new URL('../../design/screens/game-velvet/', import.meta.url));
mkdirSync('app', { recursive: true });
const shell = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'chromium_headless_shell-1234', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const browser = await chromium.launch(existsSync(shell) ? { executablePath: shell } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const name of screens) {
  await page.goto(`file:///${dir.replace(/\\/g, '/')}${name}.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3500); // let the entrance animations finish
  await page.screenshot({ path: `app/${name}.png` });
  console.log(`app/${name}.png`);
}
await browser.close();
