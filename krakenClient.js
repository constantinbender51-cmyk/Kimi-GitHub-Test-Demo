// krakenClient.js  –  no extra NPM packages
import crypto from 'crypto';

const BASE = 'https://futures.kraken.com/derivatives';
const KEY  = process.env.KRAKEN_FUTURES_KEY;
const SECRET = process.env.KRAKEN_FUTURES_SECRET;

// Kraken Futures wants HMAC-SHA512 + Base64
function sign(path, nonce, postData = '') {
  const message = nonce + postData;
  return crypto
    .createHmac('sha512', Buffer.from(SECRET, 'base64'))
    .update(message)
    .digest('base64');
}

export async function sendOrder(side, size = 0.001) {
  const path = '/api/v3/sendorder';
  const nonce = Date.now().toString();
  const body = JSON.stringify({
  orderType: 'mkt',
  symbol: 'PF_XBTUSD',
  side: side.toLowerCase(),
  size: String(size)
});

// tiny helper to make sure body is non-empty
if (!body.includes('size')) throw new Error('Body malformed: ' + body);

// log short hash instead of full body to avoid truncation
console.log('body length:', body.length, 'side:', side, 'size:', size);


  const signature = sign(path, nonce, body);
  
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'APIKey':       KEY,
      'Nonce':        nonce,
      'Authent':      signature
    },
    body
  });

  const json = await res.json();
  if (!res.ok || json.result !== 'success') {
    throw new Error(`Kraken error: ${JSON.stringify(json)}`);
  }
  return json.sendStatus;
}
