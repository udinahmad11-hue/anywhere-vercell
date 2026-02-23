// api/proxy/[...url].js
// CORS Anywhere untuk Vercel - Support wildcard path

// Daftar domain yang diizinkan
const ALLOWED_DOMAINS = [
    'starhubgo.com',
    'ucdn.starhubgo.com',
    'mh-bks400-06.starhubgo.com',
    'starhubgo.secureswiftcontent.com',
    'd1k1d9j3v9x8c5.cloudfront.net',
    'd2q8p9v9j9x8c5.cloudfront.net',
    'd3k1d9j3v9x8c5.cloudfront.net'
];

// Headers yang diizinkan
const ALLOWED_HEADERS = [
    'x-requested-with',
    'content-type',
    'range',
    'referer',
    'origin',
    'accept',
    'user-agent'
];

// Method yang diizinkan
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Headers default untuk request
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://www.starhub.com/',
    'X-Forwarded-For': '42.60.0.1'
};

// Fungsi untuk validasi URL
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        
        // Cek protokol
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }
        
        // Cek domain
        const hostname = url.hostname;
        return ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
        
    } catch (error) {
        return false;
    }
}

// Fungsi untuk mendapatkan IP client
function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.headers['x-real-ip'] || req.socket.remoteAddress || '42.60.0.1';
}

// Handler utama
module.exports = async (req, res) => {
    // Handle OPTIONS request (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition');
        res.status(204).end();
        return;
    }

    // Hanya izinkan GET dan HEAD
    if (!ALLOWED_METHODS.includes(req.method)) {
        return res.status(405).json({ 
            error: 'Method not allowed',
            allowed_methods: ALLOWED_METHODS
        });
    }

    // Ambil URL dari path parameter
    const { url } = req.query;
    const targetUrl = Array.isArray(url) ? url.join('/') : url;

    if (!targetUrl) {
        return res.status(400).json({ 
            error: 'URL parameter is required',
            usage: 'https://your-domain.vercel.app/api/proxy/https://example.com/file.mpd'
        });
    }

    // Validasi URL
    if (!isValidUrl(targetUrl)) {
        return res.status(403).json({ 
            error: 'URL not allowed',
            allowed_domains: ALLOWED_DOMAINS
        });
    }

    try {
        // Parse target URL
        const parsedUrl = new URL(targetUrl);
        
        // Headers untuk request ke target
        const headers = {
            ...DEFAULT_HEADERS,
            'Host': parsedUrl.hostname,
            'X-Forwarded-For': getClientIp(req),
            'X-Real-IP': getClientIp(req)
        };

        // Forward specific headers dari client
        const forwardHeaders = ['range', 'if-range', 'if-modified-since', 'if-none-match'];
        forwardHeaders.forEach(header => {
            if (req.headers[header]) {
                headers[header] = req.headers[header];
            }
        });

        // Opsi untuk fetch
        const fetchOptions = {
            method: req.method,
            headers: headers,
            redirect: 'follow',
            follow: 5
        };

        // Fetch request ke target
        const response = await fetch(targetUrl, fetchOptions);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition');
        
        // Forward response headers
        const forwardResponseHeaders = [
            'content-type',
            'content-length',
            'content-range',
            'accept-ranges',
            'cache-control',
            'expires',
            'last-modified',
            'etag'
        ];

        forwardResponseHeaders.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                res.setHeader(header, value);
            }
        });

        // Tambahkan custom headers
        res.setHeader('X-Proxy-Server', 'Vercel-CORS-Anywhere');
        res.setHeader('X-Proxy-Timestamp', Date.now());
        
        // Set status code
        res.status(response.status);

        // Handle redirects
        if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
            const location = response.headers.get('location');
            if (location) {
                res.setHeader('Location', location);
                res.end();
                return;
            }
        }

        // Stream response body
        const reader = response.body.getReader();
        const stream = new ReadableStream({
            async start(controller) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
                controller.close();
            }
        });

        // Pipe stream ke response
        const streamResponse = new Response(stream, {
            status: response.status,
            statusText: response.statusText
        });

        // Send response
        const buffer = await streamResponse.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Konfigurasi untuk Vercel
module.exports.config = {
    api: {
        bodyParser: false,
        externalResolver: true
    }
};
