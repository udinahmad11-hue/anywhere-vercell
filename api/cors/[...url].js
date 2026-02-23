export default async function handler(req, res) {
  // Handle preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(200).end();
  }

  try {
    // ambil URL dari path
    const path = req.query.url?.join("/") || "";
    const target = decodeURIComponent(path);

    if (!target.startsWith("http")) {
      return res.status(400).send("Invalid URL");
    }

    const proxyRes = await fetch(target, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(target).host,
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });

    // copy header
    proxyRes.headers.forEach((v, k) => res.setHeader(k, v));

    // CORS header
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");

    res.status(proxyRes.status);

    const buffer = await proxyRes.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
