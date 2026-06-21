// Vercel serverless function: /api/detail?symbol=RELIANCE
// Best-effort price + profile + financials via Yahoo Finance (unofficial).
export default async function handler(req, res) {
  const sym = String(req.query.symbol || "").trim().toUpperCase();
  if (!sym) return res.status(400).json({ ok: false, error: "no symbol" });
  const UA = { "User-Agent": "Mozilla/5.0" };

  const fetchChart = async (suffix, range, interval) => {
    try {
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym + suffix)}?range=${range}&interval=${interval}`;
      const r = await fetch(u, { headers: UA });
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

  // Best-effort profile + financials (may be unavailable, esp. for ETFs).
  let about = null, financials = [], quoteType = null;
  for (const host of ["query1", "query2"]) {
    try {
      const u = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym + used)}?modules=assetProfile,summaryProfile,earnings,quoteType`;
      const r = await fetch(u, { headers: UA });
      if (!r.ok) continue;
      const j = await r.json();
      const res0 = j?.quoteSummary?.result?.[0];
      if (!res0) continue;
      about = res0?.assetProfile?.longBusinessSummary || res0?.summaryProfile?.longBusinessSummary || null;
      quoteType = res0?.quoteType?.quoteType || null;
      const q = res0?.earnings?.financialsChart?.quarterly || [];
      financials = q.map((x) => ({ label: x.date, revenue: x.revenue?.raw ?? null, earnings: x.earnings?.raw ?? null }))
        .filter((x) => x.revenue != null || x.earnings != null);
      break;
    } catch { /* try next host */ }
  }

  res.setHeader("cache-control", "s-maxage=600, stale-while-revalidate=86400");
  return res.status(200).json({
    ok: true,
    symbol: sym,
    exchange: used === ".NS" ? "NSE" : "BSE",
    currency: meta.currency || "INR",
    quoteType,
    price: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    allTimeLow,
    allTimeHigh,
    about: about ? about.slice(0, 600) : null,
    financials,
    history,
  });
}
