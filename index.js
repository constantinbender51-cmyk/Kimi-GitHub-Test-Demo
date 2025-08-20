import express from 'express';
import fetch from 'node-fetch';
import pg from 'pg';
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// create table if it doesn't exist
await pool.query(`
  CREATE TABLE IF NOT EXISTS btc_candles (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    open NUMERIC(12,2),
    high NUMERIC(12,2),
    low  NUMERIC(12,2),
    close NUMERIC(12,2),
    volume NUMERIC(20,2)
  );

  CREATE TABLE IF NOT EXISTS btc_signals (
    id SERIAL PRIMARY KEY,
    signal_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS kraken_orders (
    id SERIAL PRIMARY KEY,
    signal TEXT,
    order_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);




app.get('/', (_req, res) => res.send('🚂 Hello from Railway + phone!'));

app.get('/candles', async (_req, res) => {
  try {
    const days = 52;
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const r = await fetch(url);
    const data = await r.json();

    // data.prices and data.total_volumes are arrays of [timestamp, value]
    const prices  = data.prices;        // [time, close]
    const volumes = data.total_volumes; // [time, volume]

    const inserted = [];
    for (let i = 0; i < prices.length; i++) {
      const date = new Date(prices[i][0]).toISOString().split('T')[0]; // YYYY-MM-DD
      const close = prices[i][1];

      // CoinGecko daily endpoint returns only close; we treat it as OHLC = C
      const open  = close;
      const high  = close;
      const low   = close;
      const volume = volumes[i][1];

      const result = await pool.query(`
        INSERT INTO btc_candles (date, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date) DO NOTHING
        RETURNING *
      `, [date, open, high, low, close, volume]);

      if (result.rowCount) inserted.push(result.rows[0]);
    }

    res.json({ inserted: inserted.length, rows: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/signals", async (_req, res) => {
  try {
    // 1. pull the last 52 closes
    const { rows } = await pool.query(`
      SELECT date, close
      FROM btc_candles
      ORDER BY date ASC
    `);
    const closes = rows.map(r => Number(r.close));

    // 2. build a tiny prompt
    const prompt = `
Below are the last 52 daily closing prices of Bitcoin (oldest → newest):
${closes.join(",")}

Based only on this price history, output exactly one word: BUY, SELL, or HOLD.
No explanations.
`.trim();

    // 3. call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const signal = result.response.text().trim().toUpperCase();

    if (['BUY', 'SELL'].includes(signal)) {
  const order = await sendOrder(signal, 0.001); // 0.001 BTC notional
  await pool.query(
    `INSERT INTO kraken_orders (signal, order_id, created_at)
     VALUES ($1, $2, NOW())`,
    [signal, order.order_id]
  );
    }

    // 4. store the signal
    await pool.query(`
      INSERT INTO btc_signals (signal_text, created_at)
      VALUES ($1, NOW())
    `, [signal]);

    // 5. respond
    res.json({ signal, based_on_rows: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => console.log(`Server running on :${PORT}`));
