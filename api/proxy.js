// CORS Proxy untuk Vercel - Versi Paling Sederhana
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Dapatkan URL target dari query parameter
  const targetUrl = req.query.url;
  
  // Jika tidak ada URL, tampilkan petunjuk
  if (!targetUrl) {
    return res.status(200).json({
      service: 'CORS Proxy',
      status: 'running',
      usage: 'GET /api/proxy?url={your-url}',
      examples: [
        '/api/proxy?url=https://jsonplaceholder.typicode.com/todos/1',
        '/api/proxy?url=https://api.github.com/users/octocat'
      ],
      note: 'Add ?url= parameter with the target URL'
    });
  }
  
  try {
    // Validasi URL
    let urlToFetch = targetUrl;
    if (!urlToFetch.startsWith('http://') && !urlToFetch.startsWith('https://')) {
      urlToFetch = 'https://' + urlToFetch;
    }
    
    // Validasi format URL
    new URL(urlToFetch);
    
    console.log('Proxying to:', urlToFetch);
    
    // Buat request ke target URL
    const response = await fetch(urlToFetch, {
      headers: {
        'User-Agent': 'CORS-Proxy/1.0 (+https://github.com/your-repo)',
        'Accept': 'application/json, text/*'
      },
      timeout: 8000 // 8 detik timeout
    });
    
    // Dapatkan content type
    const contentType = response.headers.get('content-type') || 'text/plain';
    res.setHeader('Content-Type', contentType);
    
    // Dapatkan response body
    let responseBody;
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
      res.status(response.status).json(responseBody);
    } else {
      responseBody = await response.text();
      res.status(response.status).send(responseBody);
    }
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Response error yang informatif
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      targetUrl: targetUrl,
      tip: 'Make sure the URL is correct and accessible'
    });
  }
}
