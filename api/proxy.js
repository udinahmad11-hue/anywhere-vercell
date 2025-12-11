// CORS Anywhere for Vercel Serverless Functions
const cors_proxy = require('cors-anywhere');

// Heroku provides process.env.PORT, Vercel uses different env vars
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 8080;

// Create CORS Anywhere server
const server = cors_proxy.createServer({
  originWhitelist: [], // Allow all origins
  requireHeader: ['origin', 'x-requested-with'],
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Heroku-specific headers
    'x-heroku-queue-wait-time',
    'x-heroku-queue-depth',
    'x-heroku-dynos-in-use',
    'x-request-start',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc.
    xfwd: false,
  },
});

// Vercel Serverless Function Handler
module.exports = (req, res) => {
  // Remove the /api/ prefix from the path
  req.url = req.url.replace('/api/', '/');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.status(200).end();
    return;
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Proxy the request
  server.emit('request', req, res);
};
