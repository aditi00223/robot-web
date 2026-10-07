const fs = require('fs');
const path = require('path');
const pool = require('./db');

const FILE = path.join(__dirname, 'data', 'routes.json');
const warnings = [];
const warn = (m) => { warnings.push(m); console.log('  WARNING:', m); };

const validPoint = (p) =>
  Array.isArray(p) && p.length === 2 &&
  typeof p[0] === 'number' && typeof p[1] === 'number' &&
  p[0] >= -90 && p[0] <= 90 && p[1] >= -180 && p[1] <= 180;

(async () => {
  let saved = 0, skipped = 0;
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const [starts] = await pool.query(
      'SELECT id FROM start_points WHERE slug = ? OR name = ?',
      [data.start, data.start]
    );
    if (starts.length === 0) {
      console.log('Start point not found:', data.start);
      process.exit();
    }

    for (const r of data.routes || []) {
      const [found] = await pool.query('SELECT id FROM locations WHERE name = ?', [r.location]);
      if (found.length === 0) { warn(`${r.location}: place not found in database, skipped`); skipped++; continue; }
      if (!Array.isArray(r.steps) || r.steps.length === 0) { warn(`${r.location}: no steps, skipped`); skipped++; continue; }

      r.steps.forEach((s) => {
        if (String(s).length > 60) warn(`${r.location}: step is long (${String(s).length} letters): "${s}"`);
      });
      const pts = Array.isArray(r.path) ? r.path : [];
      if (pts.length === 0) warn(`${r.location}: no path, the map line will be hidden`);
      else if (!pts.every(validPoint)) { warn(`${r.location}: bad path points, skipped`); skipped++; continue; }

      await pool.query(
        `INSERT INTO routes (start_id, location_id, steps, path, distance_m, time_min)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE steps = VALUES(steps), path = VALUES(path),
           distance_m = VALUES(distance_m), time_min = VALUES(time_min)`,
        [starts[0].id, found[0].id, JSON.stringify(r.steps), JSON.stringify(pts), r.distance_m || null, r.time_min || null]
      );
      saved++;
    }

    const [missing] = await pool.query(
      `SELECT l.name FROM locations l
       LEFT JOIN routes r ON r.location_id = l.id AND r.start_id = ?
       WHERE r.id IS NULL`,
      [starts[0].id]
    );
    missing.forEach((m) => warn(`${m.name}: has no route yet`));

    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM routes');
    console.log(`\nDone. Saved: ${saved}, skipped: ${skipped}, warnings: ${warnings.length}, routes in database: ${n}`);
  } catch (err) {
    console.error('Import failed:', err.message);
  }
  process.exit();
})();