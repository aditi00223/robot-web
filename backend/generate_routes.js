const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const KEY = process.env.ORS_API_KEY;
const URL = 'https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson';
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'blocks.json'), 'utf8'));
const S = [data.start_point.latitude, data.start_point.longitude];

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function sentence(step, place) {
  const ins = step.instruction;
  const m = round10(step.distance);
  let x;
  if ((x = ins.match(/^Arrive at your destination, on the (left|right)/i))) return `${place} is on your ${x[1]}`;
  if (/^Arrive/i.test(ins)) return `${place} is ahead`;
  if ((x = ins.match(/^Head (north-east|north-west|south-east|south-west|north|south|east|west)/i)))
    return `Walk ${x[1].toLowerCase()} for ${m} metres`;
  if (/^Continue/i.test(ins)) return `Go straight for ${m} metres`;
  if ((x = ins.match(/^Turn (sharp |slight )?(left|right)/i))) {
    const mod = x[1] ? (x[1].trim().toLowerCase() === 'slight' ? 'slightly ' : 'sharply ') : '';
    return `Turn ${mod}${x[2].toLowerCase()} and walk ${m} metres`;
  }
  if ((x = ins.match(/^Keep (left|right)/i))) return `Keep ${x[1].toLowerCase()} and walk ${m} metres`;
  if (/^Make a U-turn/i.test(ins)) return `Turn around and walk ${m} metres`;
  return `${ins.replace(/ onto .*/i, '')} and walk ${m} metres`;
}

(async () => {
  if (!KEY) { console.log('ORS_API_KEY is missing in .env'); process.exit(); }
  const routes = [], ok = [], check = [];
  let i = 0;

  for (const b of data.blocks) {
    i++;
    const E = [b.latitude, b.longitude];
    const straight = metres(S, E);
    let note = '', entry = null;

    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { Authorization: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [[S[1], S[0]], E.slice().reverse()],
          instructions: true, language: 'en', units: 'm',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        note = `OpenRouteService error ${res.status}`;
      } else {
        const f = json.features[0];
        const dist = f.properties.summary.distance;
        const line = f.geometry.coordinates.map((c) => [+c[1].toFixed(6), +c[0].toFixed(6)]);
        const gapEnd = metres(E, line[line.length - 1]);
        const ratio = dist / Math.max(straight, 1);
        if (ratio > 1.5 && dist - straight > 60) note = `route is ${ratio.toFixed(1)}x longer than the straight line`;
        else if (gapEnd > 60) note = `route ends ${Math.round(gapEnd)} m from the place`;
        else {
          entry = {
            location: b.name,
            distance_m: round10(dist),
            time_min: Math.max(1, Math.ceil(f.properties.summary.duration / 60)),
            steps: f.properties.segments[0].steps.map((s) => sentence(s, b.name)),
            path: line,
          };
        }
      }
    } catch (e) {
      note = 'request failed: ' + e.message;
    }

    if (entry) {
      routes.push(entry);
      ok.push(b.name);
      console.log(`${i}/${data.blocks.length} ${b.name}: ok`);
    } else {
      routes.push({
        location: b.name,
        distance_m: round10(straight),
        time_min: Math.max(1, Math.ceil(straight / 80)),
        steps: [`Walk ${bearing(S, E)} for about ${round10(straight)} metres`, `${b.name} is ahead`],
        path: [S, E],
        check: true,
        note,
      });
      check.push(`${b.name} (${note})`);
      console.log(`${i}/${data.blocks.length} ${b.name}: NEEDS CHECK - ${note}`);
    }
    await wait(1700);
  }

  fs.writeFileSync(path.join(__dirname, 'data', 'routes_draft.json'),
    JSON.stringify({ start: 'main_gate', routes }, null, 2));
  console.log(`\nDraft saved: data/routes_draft.json`);
  console.log(`OK: ${ok.length}, needs your check: ${check.length}`);
  check.forEach((c) => console.log('  - ' + c));
  process.exit();
})();