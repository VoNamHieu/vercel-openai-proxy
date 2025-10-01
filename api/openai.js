// Serverless function: proxies to OpenAI from a supported region
export default async function handler(req, res) {
    // --- Basic CORS (tighten origin in production) ---
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
  
    try {
      // Safely read raw body (works reliably on Vercel Node runtime)
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
  
      // Default to Responses API (recommended). You can forward any JSON body.
      // https://platform.openai.com/docs/api-reference/responses
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
  
      // Pass through status + body
      const text = await r.text();
      res.status(r.status).send(text);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "proxy_failed", message: e.message });
    }
  }
  