const pool = require('./db');

(async () => {
  try {
    await pool.query(
      `INSERT IGNORE INTO categories (name) VALUES ('Academic Blocks'), ('Hostels')`
    );

    await pool.query(
      `INSERT INTO start_points (name, latitude, longitude)
       VALUES ('Main Gate', 30.000000, 76.000000)
       ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)`
    );

    const [[cat]] = await pool.query(
      `SELECT id FROM categories WHERE name = 'Academic Blocks'`
    );

    await pool.query(
      `INSERT INTO locations (category_id, name, description, latitude, longitude, photo_url)
       VALUES (?, 'CSE Block', 'Computer Science labs and classrooms. 4 floors.', 30.001000, 76.001000, '/images/blocks/cse_block.jpg')
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [cat.id]
    );

    const [rows] = await pool.query(
      `SELECT l.id, l.name, c.name AS category, l.latitude, l.longitude, l.photo_url
       FROM locations l JOIN categories c ON c.id = l.category_id`
    );
    console.log('Locations in database:');
    console.table(rows);
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
  process.exit();
})();