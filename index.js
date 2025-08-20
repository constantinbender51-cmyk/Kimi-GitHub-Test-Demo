const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// connect using the variable Railway injects
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/', (_req, res) => res.send('🚂 Hello from Railway + phone!'));

// simple DB route
app.get('/db', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    res.json({ db_time: rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
