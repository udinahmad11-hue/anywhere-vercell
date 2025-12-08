// File: api/proxy.js
// Simple CORS proxy for Vercel

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "";

function isOriginAllowed(origin) {
  if (!ALLOWED_ORIGINS) return true;
  const allowed = ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}

module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin || '';

    if (req.method === 'OPTIONS') {
      if (!isOriginAllowed(origin)) {
        res.statusCode = 403;
        return res.end('CORS origin not allowed');
      }
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.statusCode = 204;
      return res.end();
    }

    if (!isOriginAllowed(origin)) {
      res.statusCode = 403;
      return res.end('CORS origin not allowed');
    }

    const target = Array.isArray(req.query?.url)
      ? req.query.url[0]
      : req.query?.url || req.url.split('?url=')[1];

    if (!target) {
      res.statusCode = 400;
      return res.end('Missing `url` query parameter');
    }

    if (/^file:|^https?:\/\/127\.|^https?:\/\/localhost|^https?:\/\/\[::1\]/i.test(target)) {
      res.statusCode = 400;
      return res.end('Target not allowed');
    }

    const method = req.method;
    const incomingHeaders = { ...req.headers };
    delete incomingHeaders.host;
    delete incomingHeaders.connection;
    delete incomingHeaders['content-length'];

    const fetchOptions = {
      method,
      headers: incomingHeaders,
      body: ['GET','HEAD','DELETE','OPTIONS'].includes(method) ? undefined : req.body
    };

    const upstreamRes = await fetch(target, fetchOptions);

    res.statusCode = upstreamRes.status;

    upstreamRes.headers.forEach((value, name) => {
      const lname = name.toLowerCase();
      if ([
        'transfer-encoding','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','upgrade'
      ].includes(lname)) return;
      if (lname === 'set-cookie') return;
      res.setHeader(name, value);
    });

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const body = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(body);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);

  } catch (err) {
    console.error('Proxy error', err);
    res.statusCode = 500;
    res.end('Proxy error');
  }
};
