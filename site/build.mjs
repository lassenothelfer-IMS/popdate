// Builds Popdate's public pages (Terms of Use, Privacy Policy) into `_site/`
// for GitHub Pages. The text comes from the app itself,
// `mobile/src/features/settings/legal-screen.tsx`, so the website and the app
// can't drift apart. Run: `node site/build.mjs`. `.github/workflows/pages.yml`
// runs it and deploys on every push that changes the text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'mobile/src/features/settings/legal-screen.tsx'), 'utf8');

const updated = source.match(/const UPDATED = '([^']+)';/)?.[1];
const literal = source.match(/const DOCS: Record<LegalDoc, Section\[\]> = (\{[\s\S]*?\n\});/)?.[1];
if (!updated || !literal) throw new Error('Could not find UPDATED and DOCS in legal-screen.tsx');
// Plain object literal of strings: our own file, evaluated at build time only.
const docs = new Function(`return ${literal};`)();

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A mailto link for the support address, wherever it appears.
const linkify = (html) =>
  html.replace(/([\w.+-]+@[\w-]+\.[\w.]+[a-z])/g, '<a href="mailto:$1">$1</a>');

function page({ title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Hanken+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --page: #FBF7F2; --text: #2B2527; --muted: #6E6266; --line: #E8DFD6; --accent: #D9574A; }
  @media (prefers-color-scheme: dark) {
    :root { --page: #2B2527; --text: #F6EFE6; --muted: #B8ADA3; --line: #4A4144; --accent: #F0695C; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--text);
    font: 17px/1.6 'Hanken Grotesk', -apple-system, system-ui, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 48px 20px 72px; }
  .brand { font-family: Gloock, Georgia, serif; font-size: 22px; color: var(--text); text-decoration: none; }
  .brand span { color: var(--accent); }
  h1 { font-family: Gloock, Georgia, serif; font-weight: 400; font-size: 40px; line-height: 1.15; margin: 32px 0 8px; }
  h2 { font-size: 18px; font-weight: 600; margin: 32px 0 6px; }
  p { margin: 0; }
  .updated { color: var(--muted); font-size: 15px; }
  a { color: var(--accent); }
  nav { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 15px; color: var(--muted); }
  nav a { margin-right: 16px; }
  ul.links { padding: 0; list-style: none; } ul.links li { margin: 10px 0; }
</style>
</head>
<body>
<main>
<a class="brand" href="../">Popdate<span>.</span></a>
${body}
</main>
</body>
</html>
`;
}

const NAMES = { terms: 'Terms of Use', privacy: 'Privacy Policy' };

function legalPage(doc) {
  const sections = docs[doc]
    .map(({ title, body }) => `<h2>${escape(title)}</h2>\n<p>${linkify(escape(body))}</p>`)
    .join('\n');
  return page({
    title: `${NAMES[doc]} · Popdate`,
    description: `Popdate's ${NAMES[doc]}.`,
    body: `<h1>${NAMES[doc]}</h1>
<p class="updated">Last updated: ${escape(updated)}</p>
${sections}
<nav><a href="../terms/">Terms of Use</a><a href="../privacy/">Privacy Policy</a></nav>`,
  });
}

const out = join(root, '_site');
function write(path, html) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), html);
}

write('terms/index.html', legalPage('terms'));
write('privacy/index.html', legalPage('privacy'));
write(
  'index.html',
  page({
    title: 'Popdate',
    description: 'Popdate, the dating game.',
    body: `<h1>Popdate</h1>
<p>A dating game: six people in a room, one chooser, and balloons that pop until two of you match.</p>
<ul class="links">
<li><a href="terms/">Terms of Use</a></li>
<li><a href="privacy/">Privacy Policy</a></li>
<li><a href="mailto:support@popdate.app">support@popdate.app</a></li>
</ul>`,
  }).replace('href="../"', 'href="./"'),
);
console.log(`Built _site/ (updated ${updated}): index, terms, privacy`);
