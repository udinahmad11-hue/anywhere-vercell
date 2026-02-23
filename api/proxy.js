export default async function handler(req, res) {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send("Missing ?url=");
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*"
            }
        });

        const body = await response.text();

        // ===== CORS HEADERS =====
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");

        res.status(200).send(body);

    } catch (err) {
        res.status(500).send("Proxy error: " + err.message);
    }
}
