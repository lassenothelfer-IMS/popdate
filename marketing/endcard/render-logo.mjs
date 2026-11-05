import { mkdirSync } from 'node:fs';
import { openPage } from './serve.mjs';

mkdirSync('out/logo', { recursive: true });

for (const mode of ['lockup-dark', 'lockup-light', 'icon']) {
  const { page, close } = await openPage(`logo.html?mode=${mode}`, { width: 1400, height: 1100 });
  const target = page.locator(mode === 'icon' ? '.icon' : '.lockup');
  await target.screenshot({ path: `out/logo/popdate-${mode}.png`, omitBackground: true });
  await close();
  console.log(`out/logo/popdate-${mode}.png`);
}
