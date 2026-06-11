// Vercel serverless function: /api/quote?symbols=RELIANCE,TCS
// Best-effort live prices via Yahoo Finance (unofficial — may break).
// Tries NSE (.NS) then BSE (.BO). Returns { SYMBOL: price }.
export default async function handler(req, res) {
  const raw = (req.query.symbols || "").toString();
  const symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);
  const out = {};
  await Promise.all(symbols.map(async (sym) => {
    for (const suffix of [".NS", ".BO"]) {
      try {
        const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym + suffix)}`;
        const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!r.ok) continue;
        const j = await r.json();
        const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === "number") { out[sym] = price; return; }
      } catch { /* try next suffix */ }
    }
  }));
  res.setHeader("cache-control", "no-store");
  return res.status(200).json({ prices: out });
}
