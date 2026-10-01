const pool = require('./db');

const tables = [
  `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
  )`,

  `CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    photo_url VARCHAR(255),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS location_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    photo_url VARCHAR(255) NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS start_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_id INT NOT NULL,
    location_id INT NOT NULL,
    steps JSON,
    path JSON,
    distance_m INT,
    time_min INT,
    UNIQUE KEY uniq_route (start_id, location_id),
    FOREIGN KEY (start_id) REFERENCES start_points(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS photos (
    id VARCHAR(32) PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL
  )`,
];

(async () => {
  try {
    for (const sql of tables) {
      await pool.query(sql);
    }
    const [rows] = await pool.query('SHOW TABLES');
    console.log('Tables ready:');
    rows.forEach((r) => console.log(' -', Object.values(r)[0]));
  } catch (err) {
    console.error('Setup failed:', err.message);
  }
  process.exit();
})();