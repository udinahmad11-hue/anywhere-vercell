// api/proxy.js - VERSI SIMPLE YANG PASTI BERJALAN
export default async function handler(req, res) {
  // 1. Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // 2. Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 3. Extract URL from path: /api/proxy/https://example.com
  const fullUrl = req.url;
  console.log('Request URL:', fullUrl);
  
  // Remove '/api/proxy' prefix
  let targetUrl = '';
  if (fullUrl.startsWith('/api/proxy/')) {
    targetUrl = fullUrl.substring('/api/proxy/'.length);
  } else if (req.query.url) {
    // Fallback: support query parameter
    targetUrl = req.query.url;
  }
  
  // 4. If no URL, show usage
  if (!targetUrl) {
    return res.json({
      message: 'Hue CORS Proxy is running!',
      usage: 'GET /api/proxy/{your-full-url}',
      example: '/api/proxy/https://jsonplaceholder.typicode.com/todos/1',
      note: 'URL must include http:// or https://'
    });
  }
  
  // 5. Add https:// if missing
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    console.log('Proxying to:', targetUrl);
    
    // 6. Fetch the target URL
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Hue-CORS-Proxy/1.0'
      }
    });
    
    // 7. Get response content
    const data = await response.text();
    
    // 8. Copy content-type header
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // 9. Send response
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      targetUrl: targetUrl
    });
  }
}
