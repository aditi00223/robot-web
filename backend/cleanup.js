const fs = require('fs');
const path = require('path');
const pool = require('./db');

const confirm = process.argv.includes('--yes');

(async () => {
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'blocks.json'), 'utf8')
    );
    const keep = new Set((data.blocks || []).map((b) => b.name));
    if (keep.size === 0) {
      console.log('blocks.json has no places, stopping.');
      process.exit();
    }

    const [all] = await pool.query('SELECT id, name FROM locations');
    const remove = all.filter((l) => !keep.has(l.name));

    console.log(`Places in database: ${all.length}, in blocks.json: ${keep.size}`);
    if (remove.length === 0) {
      console.log('Nothing to remove.');
    } else {
      console.log('To remove:');
      remove.forEach((l) => console.log(`  - ${l.name} (id ${l.id})`));
    }

    const [emptyCats] = await pool.query(
      `SELECT c.id, c.name FROM categories c
       LEFT JOIN locations l ON l.category_id = c.id
       WHERE l.id IS NULL`
    );
    emptyCats.forEach((c) => console.log(`  - empty category: ${c.name}`));

    if (!confirm) {
      console.log('\nDry run only. Run again with --yes to delete.');
    } else {
      for (const l of remove) {
        await pool.query('DELETE FROM locations WHERE id = ?', [l.id]);
      }
      await pool.query(
        `DELETE FROM categories WHERE id NOT IN (SELECT DISTINCT category_id FROM locations)`
      );
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM locations');
      console.log(`\nDeleted. Places left: ${n}`);
    }
  } catch (err) {
    console.error('Failed:', err.message);
  }
  process.exit();
})();