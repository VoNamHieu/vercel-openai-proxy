// api/openai.js
export default async function handler(req, res) {
  try {
    // CORS (loosen/tighten as you need)
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("X-Proxy-Version", "translate-legacy-1");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    // Read incoming body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    const incoming = raw ? JSON.parse(raw) : {};

    // Detect if caller already uses Responses API
    const alreadyResponses =
      Array.isArray(incoming.input) || incoming.output_format != null || incoming.text != null;

    // Translate OLD -> NEW
    let outbound = incoming;
    if (!alreadyResponses) {
      const model = incoming.model;
      const input = Array.isArray(incoming.messages) ? incoming.messages : [];

      // Map response_format -> output_format or text.format
      let output_format, text;
      const rf = incoming.response_format;
      if (rf && rf.type === "json_schema" && rf.json_schema) {
        output_format = { type: "json_schema", json_schema: rf.json_schema };
      } else {
        text = { format: { type: "text" } };
      }

      outbound = { model, input, ...(output_format ? { output_format } : {}), ...(text ? { text } : {}) };
    }

    // Call OpenAI Responses API
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(outbound)
    });

    const data = await r.json();

    // If caller already speaks Responses API, return raw
    if (alreadyResponses) return res.status(r.status).json(data);

    // Translate NEW -> OLD shape
    const legacyText =
      data?.output?.[0]?.content?.[0]?.text ??
      data?.output_text ?? "";

    const legacy = { choices: [ { message: { content: legacyText } } ] };
    return res.status(r.status).json(legacy);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "proxy_failed", message: e.message });
  }
}
