// Saves the launch waitlist as waitlist.csv (git-ignored: it holds people's emails).
// npm run waitlist:export          from the local/dev deployment
// npm run waitlist:export -- --prod from production
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = ['convex', 'run', 'waitlist:exportCsv', ...process.argv.slice(2)];
// Read stdout even on a non-zero exit: on Windows with Node 25 the CLI can crash while closing, after printing.
const { stdout: out, stderr } = spawnSync('npx', args, { encoding: 'utf8', shell: process.platform === 'win32' });
if (!out.includes('"')) {
  console.error(stderr);
  process.exit(1);
}
// `convex run` prints the returned string as JSON.
const csv = JSON.parse(out.slice(out.indexOf('"'), out.lastIndexOf('"') + 1));
writeFileSync('waitlist.csv', `${csv}\n`);
console.log(`waitlist.csv: ${csv.split('\n').length - 1} people`);
