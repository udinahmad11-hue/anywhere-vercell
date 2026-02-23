// api/proxy/[...url].js
// CORS Anywhere untuk Vercel - ALLOW ALL DOMAINS
// Versi: 2.0 (No domain restrictions)

// Method yang diizinkan
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE', 'PATCH'];

// Headers yang diizinkan
const ALLOWED_HEADERS = [
    'x-requested-with',
    'content-type',
    'range',
    'referer',
    'origin',
    'accept',
    'user-agent',
    'authorization',
    'cookie'
];

// Fungsi untuk validasi URL (hanya cek format, domain bebas)
function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    } catch {
        return false;
    }
}

// Handler utama
export default async function handler(req, res) {
    // Handle OPTIONS request (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Access-Control-Expose-Headers', 
            'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition, Content-Encoding'
        );
        return res.status(204).end();
    }

    // Ambil URL dari query parameter atau path
    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url.join('/') : url;

    if (!targetUrl) {
        return res.status(400).json({ 
            error: 'URL parameter is required',
            usage: 'https://your-domain.vercel.app/api/proxy/https://example.com/file',
            examples: [
                '/api/proxy/https://example.com/video.mp4',
                '/api/proxy?url=https://example.com/video.mp4',
                '/proxy/https://example.com/video.mp4'
            ]
        });
    }

    // Validasi URL (hanya format, domain bebas)
    if (!isValidUrl(targetUrl)) {
        return res.status(400).json({ 
            error: 'Invalid URL format',
            message: 'Please provide a valid URL including protocol (http:// or https://)'
        });
    }

    try {
        // Parse target URL
        const parsedUrl = new URL(targetUrl);
        
        // Headers untuk request
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Host': parsedUrl.hostname,
            'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8',
            'X-Real-IP': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8'
        };

        // Forward specific headers dari client
        const forwardHeaders = [
            'range', 'if-range', 'if-modified-since', 'if-none-match',
            'authorization', 'cookie', 'origin', 'referer'
        ];
        
        forwardHeaders.forEach(header => {
            if (req.headers[header]) {
                headers[header] = req.headers[header];
            }
        });

        // Log untuk monitoring
        console.log(`[PROXY] ${req.method} ${targetUrl}`);

        // Fetch request ke target
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            redirect: 'follow',
            follow: 10
        });

        // Set CORS headers (allow all)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 
            'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition, Content-Encoding'
        );
        
        // Forward semua headers dari response
        response.headers.forEach((value, key) => {
            // Skip headers yang bermasalah
            if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // Tambahkan custom headers
        res.setHeader('X-Proxy-Server', 'Vercel-CORS-Anywhere-Allow-All');
        res.setHeader('X-Proxy-Timestamp', Date.now());
        res.setHeader('X-Proxy-URL', targetUrl);
        
        // Set status code
        res.status(response.status);

        // Handle redirects
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                // Resolve relative redirects
                const absoluteLocation = new URL(location, targetUrl).toString();
                res.setHeader('Location', absoluteLocation);
                return res.end();
            }
        }

        // Untuk response HEAD, tidak perlu body
        if (req.method === 'HEAD') {
            return res.end();
        }

        // Convert response to buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Send response
        res.send(buffer);

    } catch (error) {
        console.error('Proxy error:', error);
        
        // Error details
        const errorResponse = {
            error: 'Proxy error',
            message: error.message,
            url: targetUrl,
            method: req.method,
            timestamp: new Date().toISOString(),
            tip: 'Make sure the target URL is accessible'
        };

        res.status(500).json(errorResponse);
    }
}

// Konfigurasi untuk Vercel
export const config = {
    api: {
        bodyParser: false,
        externalResolver: true,
        responseLimit: false // No limit for large files
    }
};
