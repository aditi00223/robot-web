const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const KEY = process.env.ORS_API_KEY;
const URL = 'https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson';
const TEST = ['Block 3 Main Gate', 'Rosewood Hostel', 'Canteen'];

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'blocks.json'), 'utf8'));
const start = data.start_point;

function metres(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

(async () => {
  if (!KEY) { console.log('ORS_API_KEY is missing in .env'); process.exit(); }
  const results = [];

  for (const name of TEST) {
    const b = data.blocks.find((x) => x.name === name);
    if (!b) { console.log('Not in blocks.json:', name); continue; }
    console.log('\n=== ' + name + ' ===');
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { Authorization: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [[start.longitude, start.latitude], [b.longitude, b.latitude]],
          instructions: true,
          language: 'en',
          units: 'm',
        }),
      });
      const json = await res.json();
      if (!res.ok) { console.log('Failed:', res.status, JSON.stringify(json).slice(0, 300)); continue; }

      const f = json.features[0];
      const sum = f.properties.summary;
      const line = f.geometry.coordinates.map((c) => [c[1], c[0]]);
      const steps = f.properties.segments[0].steps;
      const straight = Math.round(metres([start.latitude, start.longitude], [b.latitude, b.longitude]));
      const gapStart = Math.round(metres([start.latitude, start.longitude], line[0]));
      const gapEnd = Math.round(metres([b.latitude, b.longitude], line[line.length - 1]));

      console.log(`Distance: ${Math.round(sum.distance)} m (straight line: ${straight} m), time: ${Math.round(sum.duration / 60)} min`);
      console.log(`Route starts ${gapStart} m from the gate and ends ${gapEnd} m from the place`);
      console.log(`Points in path: ${line.length}, steps: ${steps.length}`);
      steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.instruction} (${Math.round(s.distance)} m)`));
      results.push({ name, start: [start.latitude, start.longitude], end: [b.latitude, b.longitude], line });
    } catch (e) {
      console.log('Error:', e.message);
    }
    await new Promise((r) => setTimeout(r, 1700));
  }

  const out = path.join(__dirname, 'uploads', 'route_test.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Route test</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0}</style></head><body><div id="map"></div>
<script>
var R = ${JSON.stringify(results)};
var map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var colors = ['#d32f2f','#1976d2','#388e3c'], all = [];
R.forEach(function(r,i){
  L.polyline(r.line,{color:colors[i%3],weight:5}).addTo(map).bindPopup(r.name);
  L.polyline([r.start,r.end],{color:colors[i%3],weight:2,dashArray:'6 6'}).addTo(map);
  L.marker(r.end).addTo(map).bindPopup(r.name);
  all = all.concat(r.line);
});
if (R.length) { L.marker(R[0].start).addTo(map).bindPopup('Start: Main Gate'); map.fitBounds(all); }
</script></body></html>`);
  console.log('\nMap saved: ' + out);
  process.exit();
})();