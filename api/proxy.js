export default async function handler(req, res) {
  // 1. Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. DAPATKAN FULL PATH
  const fullPath = req.url; // Contoh: "/api/proxy/https://google.com"
  console.log('Full path received:', fullPath);
  
  // 3. EKSTRAK URL TARGET dari path
  let targetUrl = '';
  
  // Method A: Ambil semua setelah '/api/proxy/'
  if (fullPath.startsWith('/api/proxy/')) {
    targetUrl = fullPath.substring('/api/proxy/'.length);
  }
  // Method B: Jika ada di headers (kadang Vercel parse berbeda)
  else if (req.headers['x-vercel-rewrite-target']) {
    targetUrl = req.headers['x-vercel-rewrite-target'];
  }
  
  // 4. FIX: URL dengan single slash (https:/) → double slash (https://)
  if (targetUrl.includes(':/') && !targetUrl.includes('://')) {
    targetUrl = targetUrl.replace(':/', '://');
  }
  
  console.log('Target URL extracted:', targetUrl);
  
  // 5. Jika tidak ada URL, beri petunjuk
  if (!targetUrl) {
    return res.json({
      service: 'CORS Proxy (proxy.js)',
      status: 'running',
      usage: 'GET /api/proxy/{full-url}',
      example: '/api/proxy/https://jsonplaceholder.typicode.com/todos/1',
      debug: {
        receivedPath: fullPath,
        headers: req.headers
      }
    });
  }
  
  // 6. Pastikan ada protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // 7. Validasi & fetch
    const urlObj = new URL(targetUrl);
    const response = await fetch(urlObj.href, {
      headers: { 'User-Agent': 'CORS-Proxy' }
    });
    
    const data = await response.text();
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      targetUrl: targetUrl,
      debug: {
        fullPath: fullPath,
        rawTarget: targetUrl
      }
    });
  }
}
