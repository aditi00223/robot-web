const pool = require('./db');

(async () => {
  try {
    const [r] = await pool.query(
      `UPDATE start_points SET name = 'Robot', latitude = ?, longitude = ? WHERE slug = 'main_gate'`,
      [30.682404, 76.606521]
    );
    console.log('Updated rows:', r.affectedRows);
    const [rows] = await pool.query('SELECT id, name, slug, latitude, longitude FROM start_points');
    console.table(rows);
  } catch (e) {
    console.error('Failed:', e.message);
  }
  process.exit();
})();