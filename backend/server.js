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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));