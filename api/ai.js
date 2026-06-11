// Vercel serverless function: /api/ai
// Keeps the Anthropic API key on the server. The browser never sees it.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ reply: "AI is not configured yet.", actions: [] });

  try {
    const { prompt } = req.body || {};
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { reply: text || "Done.", actions: [] }; }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(200).json({ reply: "AI request failed. Manual controls still work.", actions: [] });
  }
}
