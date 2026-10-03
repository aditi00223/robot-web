require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Building photos are served from backend/public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.send('Robot backend is running'));

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const { category_id } = req.query;
    let sql = 'SELECT id, name, category_id, photo_url AS thumb_url FROM locations';
    const params = [];
    if (category_id) {
      sql += ' WHERE category_id = ?';
      params.push(category_id);
    }
    sql += ' ORDER BY name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/locations/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, latitude, longitude, photo_url
       FROM locations WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const loc = rows[0];
    loc.latitude = loc.latitude === null ? null : Number(loc.latitude);
    loc.longitude = loc.longitude === null ? null : Number(loc.longitude);

    const [extra] = await pool.query(
      'SELECT photo_url FROM location_photos WHERE location_id = ?',
      [loc.id]
    );
    loc.photos = extra.map((p) => p.photo_url);
    res.json(loc);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
}); 


app.get('/api/directions', async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required' });
    }

    const [starts] = await pool.query(
      'SELECT id FROM start_points WHERE slug = ? OR name = ?',
      [from, from]
    );
    if (starts.length === 0) {
      return res.status(404).json({ error: 'Start point not found' });
    }

    const [rows] = await pool.query(
      `SELECT l.name AS \`to\`, r.distance_m, r.time_min, r.steps, r.path
       FROM routes r JOIN locations l ON l.id = r.location_id
       WHERE r.start_id = ? AND r.location_id = ?`,
      [starts[0].id, to]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No route found' });
    }

    const row = rows[0];
    const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v || []);
    res.json({
      to: row.to,
      distance_m: row.distance_m,
      time_min: row.time_min,
      steps: parse(row.steps),
      path: parse(row.path),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

app.set('trust proxy', 1);

const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG or PNG allowed'));
  },
});

app.post('/api/photos', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }
    try {
      const id = crypto.randomBytes(6).toString('hex');
      const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
      const filename = id + '.' + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

      await pool.query('INSERT INTO photos (id, image_url) VALUES (?, ?)', [
        id,
        '/uploads/' + filename,
      ]);

      const base = process.env.PUBLIC_URL || req.protocol + '://' + req.get('host');
      res.json({ id, url: base + '/photo/' + id });
    } catch (e) {
      console.error(e.message);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

const pageShell = (body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your Photo</title>
<style>
  body { margin: 0; font-family: Arial, sans-serif; background: #f4f6fa; color: #222; text-align: center; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 20px 14px 40px; }
  h1 { font-size: 22px; margin: 10px 0 16px; }
  img { width: 100%; height: auto; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,.2); }
  .btn { display: inline-block; margin-top: 20px; padding: 14px 32px; background: #1a73e8; color: #fff;
         text-decoration: none; border-radius: 8px; font-size: 18px; }
  p { font-size: 16px; line-height: 1.5; }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;

async function findPhoto(id) {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  const [rows] = await pool.query(
    'SELECT id, image_url FROM photos WHERE id = ? AND (expires_at IS NULL OR expires_at > NOW())',
    [id]
  );
  return rows[0] || null;
}

app.get('/photo/:id', async (req, res) => {
  try {
    const photo = await findPhoto(req.params.id);
    if (!photo) {
      return res.status(404).send(pageShell(
        '<h1>Photo not found</h1><p>This photo link is missing or has expired. Please ask the robot to take a new one.</p>'
      ));
    }
    res.send(pageShell(
      `<h1>Your photo from the robot</h1>
       <img src="${photo.image_url}" alt="Your photo">
       <a class="btn" href="/photo/${photo.id}/download">Download</a>`
    ));
  } catch (err) {
    console.error(err.message);
    res.status(500).send(pageShell('<h1>Something went wrong</h1><p>Please try again in a moment.</p>'));
  }
});

app.get('/photo/:id/download', async (req, res) => {
  try {
    const photo = await findPhoto(req.params.id);
    if (!photo) return res.status(404).send('Photo not found');
    const file = path.join(__dirname, photo.image_url);
    res.download(file, 'robot-photo' + path.extname(file));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const siteShell = (title, body, head = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { margin: 0; font-family: Arial, sans-serif; background: #f4f6fa; color: #222; }
  header { background: #1a73e8; color: #fff; padding: 16px; text-align: center; font-size: 20px; }
  header a { color: #fff; text-decoration: none; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px 14px 40px; }
  h2 { font-size: 18px; margin: 24px 0 10px; color: #1a73e8; }
  .card { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 10px;
          padding: 10px; margin-bottom: 10px; text-decoration: none; color: #222;
          box-shadow: 0 1px 6px rgba(0,0,0,.12); }
  .card img { width: 96px; height: 64px; object-fit: cover; border-radius: 6px; background: #ddd; flex-shrink: 0; }
  .card span { font-size: 17px; }
  .hero { width: 100%; height: auto; border-radius: 10px; margin-top: 10px; }
  #map { height: 300px; border-radius: 10px; margin-top: 16px; }
  p { font-size: 16px; line-height: 1.5; }
</style>
${head}
</head>
<body>
<header><a href="/locations">Campus Locations</a></header>
<div class="wrap">${body}</div>
</body>
</html>`;

app.get('/locations', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.name, l.photo_url, c.name AS category
       FROM locations l JOIN categories c ON c.id = l.category_id
       ORDER BY c.id, l.name`
    );
    let html = '';
    let current = null;
    for (const r of rows) {
      if (r.category !== current) {
        current = r.category;
        html += `<h2>${esc(current)}</h2>`;
      }
      const img = r.photo_url ? `<img src="${esc(r.photo_url)}" alt="">` : '<img alt="">';
      html += `<a class="card" href="/locations/${r.id}">${img}<span>${esc(r.name)}</span></a>`;
    }
    if (!html) html = '<p>No locations yet.</p>';
    res.send(siteShell('Campus Locations', html));
  } catch (err) {
    console.error(err.message);
    res.status(500).send(siteShell('Error', '<p>Something went wrong. Please try again.</p>'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));