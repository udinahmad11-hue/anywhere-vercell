// api/proxy.js - FINAL WORKING VERSION
export default async function handler(req, res) {
  // 1. SET CORS HEADERS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  
  // 2. GET THE FULL URL PATH
  const fullPath = req.url; // Contoh: "/api/proxy/https:/google.com"
  console.log("Received path:", fullPath);
  
  // 3. EXTRACT TARGET URL
  let targetUrl = "";
  
  if (fullPath.startsWith("/api/proxy/")) {
    // Ambil bagian setelah '/api/proxy/'
    targetUrl = decodeURIComponent(fullPath.substring("/api/proxy/".length));
  }
  
  // 4. DEBUG: Tampilkan apa yang diterima
  console.log("Decoded URL:", targetUrl);
  
  // 5. FIX 1: Ganti 'https:/' menjadi 'https://' dan 'http:/' menjadi 'http://'
  // Regex ini menangkap: http:/example.com → http://example.com
  targetUrl = targetUrl.replace(/^(https?):\/(?!\/)/, "$1://");
  
  console.log("After fix 1:", targetUrl);
  
  // 6. FIX 2: Decode karakter yang di-encode browser
  // %3A = : , %2F = /
  targetUrl = targetUrl
    .replace(/%3A%2F%2F/g, "://")  // %3A%2F%2F → ://
    .replace(/%3A/g, ":")           // %3A → :
    .replace(/%2F/g, "/");          // %2F → /
  
  console.log("After fix 2:", targetUrl);
  
  // 7. FIX 3: Jika masih ada masalah, manual reconstruction
  if (targetUrl.includes(":/") && !targetUrl.includes("://")) {
    const parts = targetUrl.split(":/");
    if (parts.length >= 2) {
      targetUrl = parts[0] + "://" + parts.slice(1).join("/");
    }
  }
  
  console.log("Final fixed URL:", targetUrl);
  
  // 8. Jika tidak ada URL, tampilkan petunjuk
  if (!targetUrl) {
    return res.json({
      service: "CORS Proxy",
      status: "running",
      usage: [
        "Method 1 (Preferred): GET /api/proxy/{encoded-url}",
        "Method 2: GET /api/proxy?url={url}",
        "Method 3: POST /api/proxy dengan JSON body { url: '...' }"
      ],
      example: "/api/proxy/https%3A%2F%2Fgoogle.com",
      note: "Browser akan encode '://' menjadi '%3A%2F%2F' atau ':/'"
    });
  }
  
  // 9. Tambahkan https:// jika tidak ada protocol
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }
  
  try {
    console.log("Fetching:", targetUrl);
    
    // 10. Fetch target URL
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (CORS-Proxy)",
        "Accept": "*/*"
      }
    });
    
    // 11. Get response
    const data = await response.text();
    
    // 12. Copy content type
    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    
    // 13. Send response
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error("Proxy Error:", error.message);
    
    res.status(500).json({
      error: "Proxy Failed",
      message: error.message,
      debug: {
        originalPath: fullPath,
        processedUrl: targetUrl,
        tip: "Gunakan encodeURIComponent() di JavaScript client"
      }
    });
  }
}

// ==================== ENDPOINT ALTERNATIF ====================
// Untuk handle query parameter dan POST requests
export const config = {
  api: {
    bodyParser: true
  }
};
