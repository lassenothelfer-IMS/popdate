import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Serves the whole marketing folder, so scenes can use the end card's balloon, fonts and grain.
const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };

/** Serves the marketing folder on localhost (ES modules don't load from file://) and opens a headless page. */
export async function openPage(path, viewport) {
  const server = createServer((req, res) => {
    const file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // Reuses the headless shell the app's Playwright already downloaded, so nothing else is fetched.
  const shell = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'chromium_headless_shell-1234', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  const browser = await chromium.launch(existsSync(shell) ? { executablePath: shell } : {});
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('page error:', err.message));
  page.on('console', (msg) => msg.type() === 'error' && console.error('console:', msg.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/stickman/${path}`);
  await page.waitForFunction(() => window.ready === true);
  return {
    page,
    async close() {
      await browser.close();
      server.close();
    },
  };
}
