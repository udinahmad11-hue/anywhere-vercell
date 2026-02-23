// CORS Anywhere untuk Vercel - Support MPD & API
// Format: https://server.vercel.app/api/URL_TARGET

// Daftar IP Singapore
const SINGAPORE_IPS = [
    '118.200.0.1',    // SingNet
    '116.14.0.1',     // SingTel
    '203.116.0.1',    // StarHub
    '119.56.0.1',     // M1
    '124.13.0.1',     // ViewQwest
    '138.75.0.1',     // MyRepublic
    '42.60.0.1',      // SingTel Fiber
    '175.156.0.1',    // StarHub Cable
    '202.156.0.1',    // SingTel ADSL
    '116.15.0.1'      // SingTel Mobile
];

// Dapatkan random IP Singapore
function getSingaporeIP() {
    return SINGAPORE_IPS[Math.floor(Math.random() * SINGAPORE_IPS.length)];
}

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'X-Proxy-Server': 'CORS-Anywhere-SG'
};

// Handler utama
module.exports = async (req, res) => {
    const { method, headers, query, body } = req;
    
    // Handle OPTIONS (preflight)
    if (method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,HEAD,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).end();
    }

    // Ambil target URL dari query parameter atau path
    let targetUrl = query.url || req.query.url;
    
    // Jika tidak ada di query, ambil dari path (catch-all)
    if (!targetUrl && req.url) {
        const pathParts = req.url.split('/');
        pathParts.shift(); // Hapus 'api'
        if (pathParts[0] === 'api') pathParts.shift();
        targetUrl = pathParts.join('/');
    }

    // Validasi URL
    if (!targetUrl) {
        return res.status(400).json({
            error: 'Missing URL',
            usage: '/api/URL_TARGET atau ?url=URL_TARGET',
            example: '/api/https://example.com/video.mpd'
        });
    }

    // Bersihkan URL
    targetUrl = targetUrl.trim();
    
    // Tambahkan https:// jika perlu
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    // Hapus protocol duplikat
    targetUrl = targetUrl.replace(/(https?:\/\/)+/g, '$1');

    try {
        // Validasi URL
        new URL(targetUrl);
    } catch (e) {
        return res.status(400).json({
            error: 'Invalid URL',
            url: targetUrl,
            message: e.message
        });
    }

    // Siapkan headers untuk fetch
    const fetchHeaders = new Headers();
    
    // Forward headers yang penting
    const forwardHeaders = [
        'user-agent', 'accept', 'accept-encoding', 
        'content-type', 'range', 'authorization', 
        'referer', 'origin'
    ];
    
    forwardHeaders.forEach(header => {
        if (headers[header]) {
            fetchHeaders.set(header, headers[header]);
        }
    });

    // Set User-Agent default jika tidak ada
    if (!fetchHeaders.has('user-agent')) {
        fetchHeaders.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    }

    // Tambahkan X-Forwarder headers dengan IP Singapore
    const sgIP = getSingaporeIP();
    fetchHeaders.set('X-Forwarded-For', sgIP);
    fetchHeaders.set('X-Forwarded-IP', sgIP);
    fetchHeaders.set('X-Real-IP', sgIP);
    fetchHeaders.set('X-Forwarder-IP', sgIP);  // Yang kamu minta
    fetchHeaders.set('X-Forwarder', sgIP);
    fetchHeaders.set('X-Country-Code', 'SG');
    fetchHeaders.set('X-Geo-Location', 'Singapore');

    try {
        // Fetch target URL
        const fetchOptions = {
            method: method,
            headers: fetchHeaders,
            redirect: 'follow',
            follow: 5
        };

        // Tambahkan body untuk POST/PUT
        if (method !== 'GET' && method !== 'HEAD' && body) {
            fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Set response headers
        const responseHeaders = {
            ...CORS_HEADERS,
            'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
            'Cache-Control': response.headers.get('cache-control') || 'public, max-age=3600'
        };

        // Forward headers penting
        const preserveHeaders = [
            'content-length', 'content-range', 'accept-ranges',
            'last-modified', 'etag', 'content-disposition'
        ];
        
        preserveHeaders.forEach(header => {
            const value = response.headers.get(header);
            if (value) responseHeaders[header] = value;
        });

        // Set semua headers
        Object.entries(responseHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        // Untuk MPD file, pastikan content type benar
        if (targetUrl.includes('.mpd') || targetUrl.includes('manifest')) {
            res.setHeader('Content-Type', 'application/dash+xml');
        }

        // Stream response
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({
            error: 'Proxy Error',
            message: error.message,
            url: targetUrl
        });
    }
};
