export default async function handler(req, res) {
  // 1. SET CORS HEADERS UNTUK STREAMING
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle OPTIONS preflight (PENTING untuk streaming)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 2. Tangkap URL target dari path
  const fullPath = req.url;
  let targetUrl = '';
  
  if (fullPath.startsWith('/api/proxy/')) {
    targetUrl = fullPath.substring('/api/proxy/'.length);
  }
  
  // Fix single slash issue
  if (targetUrl.includes(':/') && !targetUrl.includes('://')) {
    targetUrl = targetUrl.replace(':/', '://');
  }
  
  // 3. Jika tidak ada URL, tampilkan info
  if (!targetUrl) {
    return res.json({
      service: 'CORS Proxy for Streaming',
      usage: '/api/proxy/{mpd-url}',
      note: 'Supports MPD/DASH streaming with proper headers'
    });
  }
  
  // 4. Tambahkan protocol jika perlu
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  try {
    const urlObj = new URL(targetUrl);
    
    // 5. Siapkan headers untuk request
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // PENTING: jangan gunakan compression untuk streaming
    };
    
    // 6. Forward Range header jika ada (untuk byte-range requests)
    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }
    
    // 7. Lakukan fetch dengan streaming support
    const fetchOptions = {
      method: req.method,
      headers: fetchHeaders,
      redirect: 'follow'
    };
    
    // 8. JANGAN timeout untuk streaming!
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 detik
    fetchOptions.signal = controller.signal;
    
    const response = await fetch(urlObj.href, fetchOptions);
    clearTimeout(timeout);
    
    // 9. COPY SEMUA HEADERS dari target server (kecuali beberapa)
    const headersToCopy = [
      'content-type', 'content-length', 'content-range', 'accept-ranges',
      'cache-control', 'etag', 'last-modified', 'server'
    ];
    
    headersToCopy.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });
    
    // 10. SET HEADER KHUSUS UNTUK STREAMING
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    // 11. Set content-type khusus untuk MPD
    if (urlObj.href.endsWith('.mpd') || response.headers.get('content-type')?.includes('application/dash+xml')) {
      res.setHeader('Content-Type', 'application/dash+xml');
    }
    
    // 12. Set status code
    res.status(response.status);
    
    // 13. Stream the response body (PENTING untuk video segments)
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    
    res.end();
    
  } catch (error) {
    console.error('Streaming error:', error);
    
    res.status(500).json({
      error: 'Streaming failed',
      message: error.message,
      targetUrl: targetUrl
    });
  }
}
