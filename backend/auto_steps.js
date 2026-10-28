const fs = require('fs');
const path = require('path');

const D = (f) => path.join(__dirname, 'data', f);
const blocks = JSON.parse(fs.readFileSync(D('blocks.json'), 'utf8'));
const draft = JSON.parse(fs.readFileSync(D('routes_draft.json'), 'utf8'));
const S = [blocks.start_point.latitude, blocks.start_point.longitude];

const rad = (d) => (d * Math.PI) / 180;
function metres(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) -
    Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8];
}
const round10 = (m) => Math.max(10, Math.round(m / 10) * 10);
const xy = (p) => [(p[1] - S[1]) * Math.cos(rad(S[0])) * 111320, (p[0] - S[0]) * 110540];

const OUT = D('manual_routes.txt');
if (fs.existsSync(OUT)) fs.copyFileSync(OUT, D('manual_routes.backup.txt'));

const lines = [
  '# Format:  Place | via (optional) | steps separated by semicolons',
  '# Written automatically by auto_steps.js. You can edit any line by hand.',
  '',
];
let withLandmarks = 0, plain = 0;

for (const r of draft.routes) {
  if (!r.check) continue;
  const b = blocks.blocks.find((x) => x.name === r.location);
  const E = [b.latitude, b.longitude];
  const total = metres(S, E);
  let marks = [];

  if (total > 80) {
    const [ex, ey] = xy(E);
    const len2 = ex * ex + ey * ey;
    const cands = [];
    for (const p of blocks.blocks) {
      if (p.name === b.name || p.name.length > 22) continue;
      const P = [p.latitude, p.longitude];
      if (metres(P, E) < 25 || metres(P, S) < 25) continue;
      const [px, py] = xy(P);
      const t = (px * ex + py * ey) / len2;
      const perp = Math.abs(px * ey - py * ex) / Math.sqrt(len2);
      if (t > 0.12 && t < 0.88 && perp < 45) cands.push({ p, P, t, perp });
    }
    cands.sort((a, c) => a.t - c.t);
    for (const c of cands) {
      if (marks.length < 2 && (marks.length === 0 || c.t - marks[marks.length - 1].t > 0.2)) marks.push(c);
    }
  }

  const pts = [S, ...marks.map((m) => m.P), E];
  const steps = [];
  for (let i = 1; i < pts.length; i++) {
    const dir = bearing(pts[i - 1], pts[i]);
    const m = round10(metres(pts[i - 1], pts[i]));
    const last = i === pts.length - 1;
    if (last) steps.push(`Walk ${dir} for ${m} metres`, `${b.name} is ahead`);
    else if (i === 1) steps.push(`Walk ${dir} for ${m} metres towards ${marks[0].p.name}`);
    else steps.push(`Continue ${dir} for ${m} metres to ${marks[i - 1].p.name}`);
  }
  marks.length ? withLandmarks++ : plain++;
  lines.push(`${b.name} | ${marks.map((m) => m.p.name).join(', ')} | ${steps.join('; ')}`);
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`Wrote ${withLandmarks + plain} routes to data/manual_routes.txt`);
console.log(`  with landmarks: ${withLandmarks}, plain direction only: ${plain}`);
console.log('Your old file was saved as data/manual_routes.backup.txt');
process.exit();