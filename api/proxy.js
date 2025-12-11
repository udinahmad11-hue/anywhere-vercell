// api/proxy.js - Konversi untuk Vercel
import http from 'http';
import https from 'https';
import { URL } from 'url';

export default async function handler(req, res) {
  // 1. SET CORS HEADERS (sama seperti script asli)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent");
  res.setHeader("Access-Control-Expose-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  // 2. Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // 3. Ekstrak URL target dari path (format: /api/proxy/https://example.com)
  const fullPath = req.url;
  let target = '';
  
  // Hapus prefix '/api/proxy' jika ada
  if (fullPath.startsWith('/api/proxy/')) {
    target = fullPath.substring('/api/proxy/'.length);
  } else if (fullPath.startsWith('/proxy/')) {
    target = fullPath.substring('/proxy/'.length);
  } else if (fullPath.startsWith('/')) {
    target = fullPath.substring(1); // Format: /https://example.com
  }

  // 4. Fix single slash issue (https:/ → https://)
  if (target.includes(':/') && !target.includes('://')) {
    target = target.replace(':/', '://');
  }

  // 5. Jika tidak ada URL, tampilkan usage
  if (!target || target === '') {
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(`CORS Proxy for Vercel\n\nUsage:\nGET /api/proxy/https://example.com\nPOST /api/proxy/https://api.example.com/data\n\nWith body and headers preserved.\n`);
    return;
  }

  // 6. Validasi URL
  let targetUrl;
  try {
    // Tambahkan https:// jika tidak ada protocol
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    
    targetUrl = new URL(target);
  } catch (e) {
    res.status(400).json({ 
      error: "Invalid URL", 
      message: e.message,
      usage: "Example: /api/proxy/https://example.com/api",
      received: target
    });
    return;
  }

  // 7. Helper untuk memilih client HTTP/HTTPS
  const requestClient = targetUrl.protocol === 'https:' ? https : http;

  // 8. Siapkan options untuk request proxy
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: { ...req.headers }
  };

  // 9. Hapus header yang tidak perlu
  delete options.headers.host;
  delete options.headers['content-length'];

  // 10. Log untuk debugging
  console.log(`Proxying ${req.method} to: ${targetUrl.href}`);

  // 11. Return Promise untuk async handling
  return new Promise((resolve, reject) => {
    const proxyReq = requestClient.request(options, (proxyRes) => {
      // 12. Forward status code
      res.statusCode = proxyRes.statusCode;
      
      // 13. Copy headers dan tambahkan CORS
      const headers = { ...proxyRes.headers };
      headers["access-control-allow-origin"] = "*";
      headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD";
      headers["access-control-allow-headers"] = "*";
      
      // 14. Set headers ke response
      Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
      });
      
      // 15. Pastikan CORS headers tetap ada
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      // 16. Stream response
      proxyRes.pipe(res);
      
      // 17. Handle stream end
      proxyRes.on('end', () => {
        resolve();
      });
    });

    // 18. Handle proxy request errors
    proxyReq.on("error", (err) => {
      console.error("Proxy Request Error:", err.message);
      res.status(502).json({ 
        error: "Proxy Error", 
        message: err.message,
        target: targetUrl.href
      });
      reject(err);
    });

    // 19. Set timeout (sesuai limit Vercel: 10-30 detik)
    proxyReq.setTimeout(8000, () => {
      console.error("Proxy Request Timeout");
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ 
          error: "Gateway Timeout", 
          message: "Proxy request timed out after 8 seconds" 
        });
      }
      reject(new Error('Timeout'));
    });

    // 20. Forward request body untuk method yang memiliki body
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      // Untuk Vercel, kita perlu stream body secara manual
      if (req.body) {
        if (typeof req.body === 'string') {
          proxyReq.write(req.body);
        } else if (Buffer.isBuffer(req.body)) {
          proxyReq.write(req.body);
        } else {
          proxyReq.write(JSON.stringify(req.body));
        }
      }
      proxyReq.end();
    } else {
      proxyReq.end();
    }
  });
}

// 21. Konfigurasi untuk Vercel
export const config = {
  runtime: 'nodejs18.x',
  api: {
    bodyParser: {
      sizeLimit: '4.5mb' // Maksimal sesuai limit Vercel
    },
    responseLimit: '4.5mb'
  }
};
