import express from 'express';
import fetch from 'node-fetch';
import pg from 'pg';
const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// create table if it doesn't exist
await pool.query(`
  CREATE TABLE IF NOT EXISTS btc_prices (
    id SERIAL PRIMARY KEY,
    price NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);


app.get('/', (_req, res) => res.send('🚂 Hello from Railway + phone!'));

app.get('/save-btc', async (_req, res) => {
  try {
    // 1. fetch current BTC price
    const r = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
    const data = await r.json();
    const price = Number(data.data.rates.USD);

    // 2. insert into DB
    await pool.query(
      'INSERT INTO btc_prices (price) VALUES ($1)',
      [price]
    );

    // 3. respond
    res.json({ saved: price, at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on :${PORT}`));
