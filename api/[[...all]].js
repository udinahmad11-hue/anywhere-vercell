// api/[[...all]].js - Backup handler
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // Ambil semua path segments
  const segments = req.query.all || [];
  
  if (segments.length === 0) {
    return res.json({ 
      message: "Use /proxy/{url} or /?url={url}",
      endpoints: ["/proxy/{url}", "/?url={url}", "/api/proxy/{url}"]
    });
  }
  
  // Gabungkan segments menjadi URL
  let targetUrl = segments.join("/");
  
  // Decode URL
  targetUrl = decodeURIComponent(targetUrl);
  
  // Fix single slash
  targetUrl = targetUrl.replace(/^(https?):\/(?!\/)/, "$1://");
  
  if (!targetUrl.startsWith("http")) {
    targetUrl = "https://" + targetUrl;
  }
  
  try {
    const response = await fetch(targetUrl);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
