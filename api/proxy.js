import { createProxyMiddleware } from 'http-proxy-middleware';

// Handler untuk Vercel Serverless Functions
const proxy = createProxyMiddleware({
  target: 'http://example.com', // Target dummy, akan diganti
  changeOrigin: true,
  pathRewrite: {
    '^/api/proxy': '', // Hapus /api/proxy dari path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Dapatkan URL target dari query parameter atau path
    let targetUrl = req.query.url;
    
    if (!targetUrl && req.url.includes('/proxy/')) {
      // Ekstrak URL dari path
      const pathParts = req.url.split('/proxy/');
      if (pathParts.length > 1) {
        targetUrl = 'https://' + pathParts[1];
      }
    }
    
    // Jika ada URL target, atur target proxy
    if (targetUrl) {
      try {
        const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        proxyReq.setHeader('host', url.hostname);
        proxyReq.path = url.pathname + (url.search || '');
        
        // Atur header CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
      } catch (err) {
        console.error('Invalid URL:', targetUrl);
      }
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Tambahkan header CORS ke response
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
    proxyRes.headers['access-control-allow-headers'] = '*';
    
    // Hapus beberapa header yang tidak perlu
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
  },
  router: (req) => {
    // Dapatkan URL target dari query parameter
    const targetUrl = req.query.url;
    if (targetUrl) {
      try {
        return targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
      } catch (err) {
        return 'http://example.com';
      }
    }
    
    // Coba dapatkan dari path
    if (req.url.includes('/proxy/')) {
      const pathParts = req.url.split('/proxy/');
      if (pathParts.length > 1) {
        const url = pathParts[1];
        return url.startsWith('http') ? url : `https://${url}`;
      }
    }
    
    return 'http://example.com';
  },
  selfHandleResponse: false,
  logLevel: 'silent',
});

// Handler untuk Vercel
export default function handler(req, res) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }
  
  // Gunakan proxy middleware
  return proxy(req, res, (result) => {
    if (result instanceof Error) {
      console.error('Proxy error:', result);
      res.status(500).json({ 
        error: 'Proxy error', 
        message: result.message 
      });
    }
  });
}

// Untuk pengembangan lokal
export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
  },
};
