// api/proxy.js - VERSI SIMPLE untuk Vercel
export default async function handler(req, res) {
  // 1. SET CORS HEADERS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent");
  res.setHeader("Access-Control-Expose-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  // 2. Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 3. Ambil URL dari path: /api/proxy/https://example.com
  const fullPath = req.url;
  let targetUrl = '';
  
  if (fullPath.startsWith('/api/proxy/')) {
    targetUrl = fullPath.substring('/api/proxy/'.length);
  } else if (fullPath.startsWith('/')) {
    targetUrl = fullPath.substring(1);
  }
  
  // 4. Jika tidak ada URL, tampilkan usage
  if (!targetUrl || targetUrl === '') {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(`CORS Proxy for Vercel\n\nUsage: GET /api/proxy/https://example.com\n\nExample: /api/proxy/https://jsonplaceholder.typicode.com/todos/1`);
  }
  
  // 5. Fix https:/ → https://
  if (targetUrl.includes(':/') && !targetUrl.includes('://')) {
    targetUrl = targetUrl.replace(':/', '://');
  }
  
  // 6. Tambahkan https:// jika tidak ada protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    console.log(`Proxying to: ${targetUrl}`);
    
    // 7. Fetch target URL
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'CORS-Proxy/1.0',
        'Accept': '*/*'
      }
    });
    
    // 8. Copy headers
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // 9. Get response body
    const data = await response.text();
    
    // 10. Send response
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      targetUrl: targetUrl
    });
  }
}
