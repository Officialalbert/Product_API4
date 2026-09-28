const express = require('express');
const cors = require('cors');

const { pool, initDb } = require('./db');
const { initRedis } = require('./redis');
const {
  cacheProductsList,
  saveProductsToCache,
  invalidateProductsCache,
} = require('./cache');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Логирование
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}][${req.method}] ${res.statusCode} ${req.path}`);
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) console.log('Body:', req.body);
  });
  next();
});

/* ==================== CRUD /api/products ==================== */

// CREATE
app.post('/api/products', async (req, res) => {
  const { name, price, description } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (name, price, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), price, description?.trim() || null]
    );
    await invalidateProductsCache();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/products]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// READ all — с кэшированием
app.get('/api/products', cacheProductsList, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    await saveProductsToCache(result.rows);
    res.json({
      source: 'db',
      data: result.rows,
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// READ one
app.get('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /api/products/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE
app.patch('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { name, price, description } = req.body;
  if (name === undefined && price === undefined && description === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  // Динамическая сборка SET-выражения
  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name.trim()); }
  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) return res.status(400).json({ error: 'Invalid price' });
    fields.push(`price = $${i++}`); values.push(price);
  }
  if (description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(description === null ? null : description.trim());
  }
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    await invalidateProductsCache();
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/products/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE
app.delete('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    await invalidateProductsCache();
    res.status(204).send();
  } catch (err) {
    console.error('[DELETE /api/products/:id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ==================== 404 и ошибки ==================== */
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ==================== Запуск ==================== */
(async () => {
  await initDb();
  await initRedis();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] http://0.0.0.0:${PORT}`);
  });
})();