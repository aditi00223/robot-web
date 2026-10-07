const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'data', 'manual_routes.txt');
if (fs.existsSync(OUT) && !process.argv.includes('--force')) {
  console.log('data/manual_routes.txt already exists. Not overwriting your work.');
  console.log('(Add --force only if you want to start over.)');
  process.exit();
}

const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'routes_draft.json'), 'utf8'));
const lines = [
  '# Format:  Place | via (optional) | steps separated by semicolons',
  '# via = places the walker passes, in order, separated by commas (names exactly as in blocks.json). Leave empty if none.',
  '# Keep every step short (about 30 letters is best). Do not use the | character inside a step.',
  '',
];
let n = 0;
for (const r of d.routes) {
  if (!r.check) continue;
  n++;
  lines.push(`${r.location} | | ${r.steps.join('; ')}`);
}
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`Created data/manual_routes.txt with ${n} places to fill in.`);
process.exit();