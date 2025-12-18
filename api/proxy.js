export default async function handler(req, res) {
  // Allow only GET & POST
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Basic security: block local/internal addresses
  if (
    targetUrl.startsWith("http://localhost") ||
    targetUrl.startsWith("http://127.") ||
    targetUrl.startsWith("https://127.")
  ) {
    return res.status(403).json({ error: "Forbidden target" });
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        "User-Agent": "Vercel-Proxy",
        ...(req.headers["content-type"]
          ? { "Content-Type": req.headers["content-type"] }
          : {}),
      },
    };

    if (req.method === "POST") {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    res.status(response.status);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    return res.status(500).json({
      error: "Proxy error",
      message: error.message,
    });
  }
}
