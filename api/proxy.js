export default async function handler(req, res) {
  // ===== 1. SET HEADER CORS =====
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight 24 jam

  // Tangani preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== 2. EKSTRAK URL TARGET DARI PATH =====
  // Contoh: /api/proxy/https://example.com/data → ambil bagian setelah '/api/proxy/'
  const fullPath = req.url;
  const proxyPrefix = '/api/proxy/';
  
  let targetUrl = '';
  
  if (fullPath.startsWith(proxyPrefix)) {
    targetUrl = fullPath.slice(proxyPrefix.length);
  } else if (req.query.url) {
    // Fallback: support juga via query parameter ?url=
    targetUrl = req.query.url;
  }
  
  // ===== 3. JIKA TIDAK ADA URL, BERI PETUNJUK =====
  if (!targetUrl) {
    return res.status(200).json({
      service: 'Hue Anywhere CORS Proxy',
      endpoints: {
        primary: 'GET /api/proxy/{full-url}',
        example: '/api/proxy/https://jsonplaceholder.typicode.com/todos/1',
        alt: 'GET /api/proxy?url={encoded-url}'
      }
    });
  }
  
  // ===== 4. DECODE & VALIDASI URL =====
  try {
    // Decode URL jika perlu
    targetUrl = decodeURIComponent(targetUrl);
    
    // Tambahkan protocol jika tidak ada
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    // Validasi format URL
    const urlObj = new URL(targetUrl);
    
    // ===== 5. PROXY REQUEST KE TARGET =====
    const proxyRes = await fetch(urlObj.href, {
      method: req.method,
      headers: {
        'User-Agent': 'Hue-CORS-Proxy/1.0',
        'Accept': req.headers['accept'] || '*/*',
        ...(req.headers['authorization'] && { 'Authorization': req.headers['authorization'] })
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? 
            await getRawBody(req) : undefined,
      signal: AbortSignal.timeout(10000) // Timeout 10 detik
    });
    
    // ===== 6. FORWARD RESPONSE =====
    // Salin status dan headers
    res.status(proxyRes.status);
    
    // Salin semua headers kecuali yg terkait encoding/security
    const headersToCopy = [...proxyRes.headers.entries()].filter(
      ([key]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())
    );
    
    headersToCopy.forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Pastikan header CORS tetap ada
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream response body
    const buffer = await proxyRes.arrayBuffer();
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    // ===== 7. ERROR HANDLING =====
    console.error('Proxy Error:', error.message);
    
    const errorMap = {
      'AbortError': { status: 504, message: 'Gateway Timeout' },
      'ENOTFOUND': { status: 502, message: 'Domain Not Found' },
      'ERR_INVALID_URL': { status: 400, message: 'Invalid URL Format' }
    };
    
    const errorInfo = errorMap[error.code || error.name] || 
                     { status: 500, message: 'Internal Proxy Error' };
    
    res.status(errorInfo.status).json({
      error: errorInfo.message,
      originalUrl: targetUrl,
      details: error.message
    });
  }
}

// Helper untuk membaca raw body
async function getRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
