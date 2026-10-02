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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));