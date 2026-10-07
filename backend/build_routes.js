const fs = require('fs');
const path = require('path');

const D = (f) => path.join(__dirname, 'data', f);
const blocks = JSON.parse(fs.readFileSync(D('blocks.json'), 'utf8'));
const draft = JSON.parse(fs.readFileSync(D('routes_draft.json'), 'utf8'));
const S = [blocks.start_point.latitude, blocks.start_point.longitude];
const coord = {};
blocks.blocks.forEach((b) => (coord[b.name] = [b.latitude, b.longitude]));

const rad = (d) => (d * Math.PI) / 180;
function metres(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
const round10 = (m) => Math.max(10, Math.round(m / 10) * 10);

// Read the typed routes
const manual = {};
if (fs.existsSync(D('manual_routes.txt'))) {
  fs.readFileSync(D('manual_routes.txt'), 'utf8').split(/\r?\n/).forEach((line) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const parts = line.split('|');
    if (parts.length < 3) return;
    manual[parts[0].trim()] = {
      via: parts[1].split(',').map((s) => s.trim()).filter(Boolean),
      steps: parts.slice(2).join('|').split(';').map((s) => s.trim()).filter(Boolean),
    };
  });
}

const warnings = [];
const placeholders = [];
let computed = 0, typed = 0;
const routes = [];

for (const r of draft.routes) {
  if (!r.check) {
    routes.push({ location: r.location, distance_m: r.distance_m, time_min: r.time_min, steps: r.steps, path: r.path });
    computed++;
    continue;
  }
  const m = manual[r.location];
  const isPlaceholder = !m || m.steps.length === 0 ||
    (m.steps.length === r.steps.length && m.steps.every((s, i) => s === r.steps[i]));
  if (isPlaceholder) {
    routes.push({ location: r.location, distance_m: r.distance_m, time_min: r.time_min, steps: r.steps, path: r.path });
    placeholders.push(r.location);
    continue;
  }

  const viaPoints = [];
  m.via.forEach((v) => {
    if (coord[v]) viaPoints.push(coord[v]);
    else warnings.push(`${r.location}: via place "${v}" not found in blocks.json, ignored`);
  });
  const pathPts = [S, ...viaPoints, coord[r.location]];
  let len = 0;
  for (let i = 1; i < pathPts.length; i++) len += metres(pathPts[i - 1], pathPts[i]);
  const dist = round10(len * 1.15);

  m.steps.forEach((s) => { if (s.length > 60) warnings.push(`${r.location}: long step (${s.length} letters): "${s}"`); });
  if (m.steps.length > 8) warnings.push(`${r.location}: ${m.steps.length} steps, try to keep it to 5 or fewer`);

  routes.push({ location: r.location, distance_m: dist, time_min: Math.max(1, Math.ceil(dist / 80)), steps: m.steps, path: pathPts });
  typed++;
}

Object.keys(manual).forEach((n) => {
  if (!draft.routes.some((r) => r.location === n && r.check)) warnings.push(`manual_routes.txt: "${n}" is not a flagged place (check the spelling), ignored`);
});

fs.writeFileSync(D('routes.json'), JSON.stringify({ start: 'main_gate', routes }, null, 2));
console.log(`Saved data/routes.json with ${routes.length} routes`);
console.log(`  computed from the map: ${computed}`);
console.log(`  typed by you:          ${typed}`);
console.log(`  still placeholder:     ${placeholders.length}`);
placeholders.forEach((p) => console.log('    - ' + p));
if (warnings.length) { console.log('Warnings:'); warnings.forEach((w) => console.log('  - ' + w)); }