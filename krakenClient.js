import crypto from 'crypto';

const BASE = 'https://futures.kraken.com/derivatives';
const KEY  = process.env.KRAKEN_FUTURES_KEY;
const SECRET = process.env.KRAKEN_FUTURES_SECRET;

function sign(path, nonce, postData = '') {
  const message = nonce + postData;
  return crypto
    .createHmac('sha256', Buffer.from(SECRET, 'base64'))
    .update(message)
    .digest('base64');
}

export async function sendOrder(side, size = 0.001) {
  const path = '/api/v3/sendorder';
  const nonce = Date.now().toString();
  const body = JSON.stringify({
    orderType: 'mkt',
    symbol:    'PF_XBTUSD',   // perpetual BTC/USD
    side:      side.toLowerCase(), // buy or sell
    size:      String(size),
  });
  const sig = sign(path, nonce, body);
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'APIKey': KEY,
      'Nonce':  nonce,
      'Authent': sig,
      'Content-Type': 'application/json',
    },
    body,
  });
  const json = await res.json();
  if (!res.ok || json.result !== 'success') throw new Error(JSON.stringify(json));
  return json.sendStatus;
}
