const pool = require('./db');

const routes = [
  {
    location: 'CSE Block',
    distance_m: 300,
    time_min: 4,
    steps: [
      'Go straight for 200 metres',
      'Turn left at the library',
      'CSE Block is ahead',
    ],
    path: [[30.0, 76.0], [30.0, 76.001], [30.001, 76.001]],
  },
  {
    location: 'Boys Hostel 1',
    distance_m: 500,
    time_min: 7,
    steps: [
      'Go straight for 200 metres',
      'Turn right at the playground',
      'Boys Hostel 1 is ahead',
    ],
    path: [[30.0, 76.0], [30.0, 76.001], [30.002, 76.001], [30.002, 76.002]],
  },
];

(async () => {
  try {
    const [[start]] = await pool.query(
      `SELECT id FROM start_points WHERE slug = 'main_gate'`
    );

    for (const r of routes) {
      const [found] = await pool.query('SELECT id FROM locations WHERE name = ?', [r.location]);
      if (found.length === 0) {
        console.log('WARNING: location not found:', r.location);
        continue;
      }
      await pool.query(
        `INSERT INTO routes (start_id, location_id, steps, path, distance_m, time_min)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           steps = VALUES(steps), path = VALUES(path),
           distance_m = VALUES(distance_m), time_min = VALUES(time_min)`,
        [start.id, found[0].id, JSON.stringify(r.steps), JSON.stringify(r.path), r.distance_m, r.time_min]
      );
      console.log('Saved route for', r.location);
    }

    const [rows] = await pool.query(
      `SELECT l.name, r.distance_m, r.time_min FROM routes r JOIN locations l ON l.id = r.location_id`
    );
    console.table(rows);
  } catch (err) {
    console.error('Failed:', err.message);
  }
  process.exit();
})();