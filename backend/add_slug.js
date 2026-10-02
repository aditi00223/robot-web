const pool = require('./db');

(async () => {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'start_points' AND COLUMN_NAME = 'slug'`
    );
    if (cols.length === 0) {
      await pool.query('ALTER TABLE start_points ADD COLUMN slug VARCHAR(50) UNIQUE');
      console.log('Added slug column');
    } else {
      console.log('Slug column already exists');
    }
    await pool.query(`UPDATE start_points SET slug = 'main_gate' WHERE name = 'Main Gate'`);
    const [rows] = await pool.query('SELECT id, name, slug FROM start_points');
    console.table(rows);
  } catch (err) {
    console.error('Failed:', err.message);
  }
  process.exit();
})();