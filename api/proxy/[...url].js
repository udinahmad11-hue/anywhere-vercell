// api/proxy/[...url].js
// CORS Anywhere untuk Vercel - Support Node 24.x

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

// Method yang diizinkan
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

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
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Range, Referer, Origin, Accept, User-Agent');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition');
        return res.status(204).end();
    }

    // Hanya izinkan GET dan HEAD
    if (!ALLOWED_METHODS.includes(req.method)) {
        return res.status(405).json({ 
            error: 'Method not allowed',
            allowed_methods: ALLOWED_METHODS
        });
    }

    // Ambil URL dari query parameter
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
        
        // Headers untuk request
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.starhub.com/',
            'Host': parsedUrl.hostname,
            'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '42.60.0.1'
        };

        // Forward range header jika ada
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        // Fetch request ke target
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            redirect: 'follow'
        });

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition');
        
        // Forward response headers
        const forwardHeaders = [
            'content-type',
            'content-length',
            'content-range',
            'accept-ranges',
            'cache-control',
            'last-modified'
        ];

        forwardHeaders.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                res.setHeader(header, value);
            }
        });

        // Set status code
        res.status(response.status);

        // Handle redirects
        if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
            const location = response.headers.get('location');
            if (location) {
                return res.redirect(location);
            }
        }

        // Convert response to buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Send response
        res.send(buffer);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Konfigurasi untuk Vercel
export const config = {
    api: {
        bodyParser: false,
        externalResolver: true
    }
};
