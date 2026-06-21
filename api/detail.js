// Vercel serverless function: /api/detail?symbol=RELIANCE
// Best-effort price detail via Yahoo Finance (unofficial — may break).
// Returns 1y daily history, 52-week high/low, and all-time low/high.
export default async function handler(req, res) {
  const sym = String(req.query.symbol || "").trim().toUpperCase();
  if (!sym) return res.status(400).json({ ok: false, error: "no symbol" });

  const fetchChart = async (suffix, range, interval) => {
    try {
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym + suffix)}?range=${range}&interval=${interval}`;
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.chart?.result?.[0] || null;
    } catch { return null; }
  };

  let used = null, oneY = null;
  for (const suffix of [".NS", ".BO"]) {
    oneY = await fetchChart(suffix, "1y", "1d");
    if (oneY) { used = suffix; break; }
  }
  if (!oneY) { res.setHeader("cache-control", "no-store"); return res.status(200).json({ ok: false }); }

  const meta = oneY.meta || {};
  const ts = oneY.timestamp || [];
  const closes = oneY.indicators?.quote?.[0]?.close || [];
  const history = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number") history.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: Math.round(c * 100) / 100 });
  }

  let allTimeLow = null, allTimeHigh = null;
  const mx = await fetchChart(used, "max", "1mo");
  if (mx) {
    const mc = (mx.indicators?.quote?.[0]?.close || []).filter((x) => typeof x === "number");
    if (mc.length) { allTimeLow = Math.round(Math.min(...mc) * 100) / 100; allTimeHigh = Math.round(Math.max(...mc) * 100) / 100; }
  }

  res.setHeader("cache-control", "s-maxage=600, stale-while-revalidate=86400");
  return res.status(200).json({
    ok: true,
    symbol: sym,
    exchange: used === ".NS" ? "NSE" : "BSE",
    currency: meta.currency || "INR",
    price: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    allTimeLow,
    allTimeHigh,
    history,
  });
}
