const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pool = require('./db');

const DATA_FILE = path.join(__dirname, 'data', 'blocks.json');
const PHOTO_IN = path.join(__dirname, 'data', 'photos');
const PHOTO_OUT = path.join(__dirname, 'public', 'images', 'blocks');

const warnings = [];
const warn = (msg) => { warnings.push(msg); console.log('  WARNING:', msg); };

function validCoords(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function processPhoto(file) {
  if (!file) return null;
  const src = path.join(PHOTO_IN, file);
  if (!fs.existsSync(src)) return null;
  const outName = path.parse(file).name + '.jpg';
  await sharp(src)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(path.join(PHOTO_OUT, outName));
  return '/images/blocks/' + outName;
}

(async () => {
  let added = 0, skipped = 0;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    fs.mkdirSync(PHOTO_OUT, { recursive: true });

    // Start point
    const sp = data.start_point;
    if (sp && validCoords(sp.latitude, sp.longitude)) {
      await pool.query(
        `INSERT INTO start_points (name, latitude, longitude) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)`,
        [sp.name, sp.latitude, sp.longitude]
      );
      console.log('Start point saved:', sp.name);
    } else {
      warn('Start point is missing or has bad coordinates');
    }

    // Blocks
    for (const b of data.blocks || []) {
      console.log('Importing:', b.name);
      if (!b.name || !b.category) {
        warn('A row is missing name or category, skipped');
        skipped++;
        continue;
      }
      if (!validCoords(b.latitude, b.longitude)) {
        warn(`${b.name}: bad coordinates, skipped`);
        skipped++;
        continue;
      }

      const photoUrl = await processPhoto(b.photo);
      if (!photoUrl) warn(`${b.name}: photo "${b.photo}" not found in data/photos`);
      if (!b.description) warn(`${b.name}: no description`);

      await pool.query('INSERT IGNORE INTO categories (name) VALUES (?)', [b.category]);
      const [[cat]] = await pool.query('SELECT id FROM categories WHERE name = ?', [b.category]);

      await pool.query(
        `INSERT INTO locations (category_id, name, description, latitude, longitude, photo_url)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category_id = VALUES(category_id),
           description = VALUES(description),
           latitude = VALUES(latitude),
           longitude = VALUES(longitude),
           photo_url = VALUES(photo_url)`,
        [cat.id, b.name, b.description || null, b.latitude, b.longitude, photoUrl]
      );
      added++;
    }

    console.log(`\nDone. Imported or updated: ${added}, skipped: ${skipped}, warnings: ${warnings.length}`);
  } catch (err) {
    console.error('Import failed:', err.message);
  }
  process.exit();
})();