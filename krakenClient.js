import crypto from 'crypto';        // built-in, no npm install
import axios  from 'axios';         // already in your stack

const BASE_URL = 'https://futures.kraken.com';
const API_KEY  = process.env.KRAKEN_FUTURES_KEY;
const API_SEC  = process.env.KRAKEN_FUTURES_SECRET;

let nonceCounter = 0;
function nonce() {
  if (nonceCounter === 9999) nonceCounter = 0;
  return Date.now() + ('0000' + ++nonceCounter).slice(-5);
}

function sign(endpoint, nonceStr, data) {
  const path = endpoint.startsWith('/derivatives')
    ? endpoint.slice('/derivatives'.length)
    : endpoint;
  const msg = data + nonceStr + path;
  const hash = crypto.createHash('sha256').update(msg).digest();
  const secret = Buffer.from(API_SEC, 'base64');
  return crypto.createHmac('sha512', secret).update(hash).digest('base64');
}

export async function sendOrder(side, size = 0.001) {
  const endpoint = '/derivatives/api/v3/sendorder';
  const n = nonce();
  // market order → limitPrice empty
  const data = `orderType=mkt&symbol=PF_XBTUSD&side=${side}&size=${size}&limitPrice=`;

  const headers = {
    'Accept': 'application/json',
    'APIKey': API_KEY,
    'Nonce': n,
    'Authent': sign(endpoint, n, data),
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length.toString()
  };

  const { data: resp } = await axios.post(BASE_URL + endpoint, data, { headers });
  if (resp.result !== 'success') throw new Error(JSON.stringify(resp));
  return resp.sendStatus;
}
