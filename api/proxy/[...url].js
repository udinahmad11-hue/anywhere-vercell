export default async function handler(req, res) {
    try {
        // ambil url dari path
        const raw = req.query.url;
        if (!raw) return res.status(400).send("Missing URL");

        const target = Array.isArray(raw) ? raw.join("/") : raw;

        // decode kalau ada %3A dll
        const url = decodeURIComponent(target);

        // fetch
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*"
            }
        });

        // CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");

        // copy content-type (penting untuk MPD)
        const ct = response.headers.get("content-type");
        if (ct) res.setHeader("Content-Type", ct);

        const buffer = await response.arrayBuffer();
        res.status(200).send(Buffer.from(buffer));

    } catch (e) {
        res.status(500).send("Proxy error: " + e.message);
    }
}
