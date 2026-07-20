/** Bridge Vercel Node req/res ↔ Web Request/Response used by NutriLog handlers. */

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function toWebRequest(req, { rawBody = false } = {}) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url || ''}`;

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    if (rawBody) {
      body = await readRawBody(req);
    } else if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    }
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  return new Request(url, { method: req.method, headers, body });
}

async function sendWebResponse(res, response) {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

export async function runHandler(handler, req, res, options = {}) {
  const request = await toWebRequest(req, options);
  const response = await handler(request);
  await sendWebResponse(res, response);
}

export function createApiRoute(handler, options = {}) {
  return async (req, res) => {
    try {
      await runHandler(handler, req, res, options);
    } catch (err) {
      console.error('API route error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Server error' });
      }
    }
  };
}
