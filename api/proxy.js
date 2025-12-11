export default async function handler(request, response) {
  // Set CORS headers untuk semua request
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  // Dapatkan URL target dari query parameter atau path
  let targetUrl = '';
  
  // Cek jika URL ada di query parameter
  if (request.query.url) {
    targetUrl = request.query.url;
  } 
  // Cek jika URL ada di path setelah /api/proxy/
  else if (request.url.startsWith('/api/proxy/')) {
    const pathUrl = request.url.replace('/api/proxy/', '');
    if (pathUrl) {
      targetUrl = decodeURIComponent(pathUrl);
    }
  }
  
  // Jika tidak ada URL, kembalikan petunjuk penggunaan
  if (!targetUrl) {
    return response.status(400).json({
      error: 'Missing URL parameter',
      usage: {
        method1: 'GET /api/proxy?url=https://example.com',
        method2: 'GET /api/proxy/https://example.com',
        examples: [
          '/api/proxy?url=https://jsonplaceholder.typicode.com/todos/1',
          '/api/proxy/https://api.github.com/users/octocat'
        ]
      }
    });
  }
  
  // Pastikan URL memiliki protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    // Validasi URL
    const urlObj = new URL(targetUrl);
    
    // Siapkan headers untuk request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; CORS-Proxy/1.0)',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    };
    
    // Salin beberapa headers dari request asli (opsional)
    const forwardHeaders = ['authorization', 'content-type', 'accept', 'x-requested-with'];
    forwardHeaders.forEach(header => {
      if (request.headers[header]) {
        headers[header] = request.headers[header];
      }
    });
    
    // Buat request options
    const options = {
      method: request.method,
      headers: headers,
      // Timeout 8 detik (Vercel timeout adalah 10 detik untuk free tier)
      signal: AbortSignal.timeout(8000)
    };
    
    // Tambahkan body untuk non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      // Untuk Vercel, body bisa diakses dari request.body jika bodyParser diaktifkan
      // Tapi kita akan tangani secara sederhana
      const contentType = request.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          options.body = JSON.stringify(request.body);
        } catch (e) {
          // Jika tidak bisa parse JSON, kirim raw body
          options.body = request.body;
        }
      } else {
        options.body = request.body;
      }
    }
    
    // Lakukan fetch request
    const fetchResponse = await fetch(urlObj.toString(), options);
    
    // Dapatkan content type
    const contentType = fetchResponse.headers.get('content-type') || 'text/plain';
    
    // Salin headers yang aman
    const responseHeaders = {};
    fetchResponse.headers.forEach((value, key) => {
      // Skip headers yang bisa menyebabkan masalah
      const skipHeaders = [
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'connection',
        'keep-alive',
        'upgrade',
        'host',
        'origin',
        'referer'
      ];
      
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });
    
    // Set content type
    response.setHeader('Content-Type', contentType);
    
    // Tambahkan CORS headers ke response
    response.setHeader('Access-Control-Expose-Headers', '*');
    
    // Set semua headers dari target response
    Object.entries(responseHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });
    
    // Dapatkan response body berdasarkan content type
    if (contentType.includes('application/json')) {
      const data = await fetchResponse.json();
      return response.status(fetchResponse.status).json(data);
    } else if (contentType.includes('text/') || contentType.includes('application/xml')) {
      const text = await fetchResponse.text();
      return response.status(fetchResponse.status).send(text);
    } else {
      // Untuk binary data atau type lain
      const buffer = await fetchResponse.arrayBuffer();
      response.setHeader('Content-Length', buffer.byteLength);
      return response.status(fetchResponse.status).send(Buffer.from(buffer));
    }
    
  } catch (error) {
    console.error('Proxy Error:', error);
    
    // Berikan error response yang lebih informatif
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return response.status(504).json({
        error: 'Gateway Timeout',
        message: 'The request took too long to complete',
        code: 'TIMEOUT'
      });
    } else if (error.code === 'ENOTFOUND') {
      return response.status(404).json({
        error: 'Domain Not Found',
        message: `Cannot resolve hostname: ${targetUrl}`,
        code: 'DNS_ERROR'
      });
    } else if (error instanceof TypeError && error.message.includes('fetch failed')) {
      return response.status(502).json({
        error: 'Bad Gateway',
        message: 'Failed to fetch the target URL',
        code: 'FETCH_ERROR'
      });
    } else {
      return response.status(500).json({
        error: 'Proxy Error',
        message: error.message,
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

// Konfigurasi untuk Vercel
export const config = {
  runtime: 'nodejs18.x',
  // Nonaktifkan bodyParser untuk menangani berbagai content types
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    },
    responseLimit: '4mb'
  }
};
