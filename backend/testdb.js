const pool = require('./db');

(async () => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS db');
    console.log('Connected to database:', rows[0].db);
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
  process.exit();
})();