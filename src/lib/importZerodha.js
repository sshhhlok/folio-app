import * as XLSX from "xlsx";

// Broker-agnostic holdings import. Works with Zerodha, Groww, Upstox,
// Angel One, ICICI Direct, Dhan, HDFC, etc. by matching column names by
// alias instead of exact text. Returns [{ symbol, qty, avg, ltp, sector, tier }].

const ALIASES = {
  symbol: ["symbol", "tradingsymbol", "trading symbol", "instrument", "scrip", "scrip name",
           "stock", "stock name", "stock symbol", "security", "security name", "company", "company name", "name"],
  qty:    ["quantity available", "net quantity", "quantity", "qty", "units", "shares",
           "holding qty", "total qty", "free qty", "holdings", "no. of shares", "balance"],
  avg:    ["average price", "avg price", "avg. price", "buy avg", "buy average", "average cost",
           "avg cost", "avg buy price", "buy price", "cost price", "average", "avg"],
  ltp:    ["previous closing price", "last traded price", "ltp", "last price", "current price",
           "close price", "closing price", "market price", "cmp", "prev close", "current market price"],
  sector: ["sector", "industry"],
};

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");

function matchCol(header, aliases) {
  // exact alias match first, then "contains"
  for (const a of aliases) { const i = header.findIndex((h) => h === a); if (i > -1) return i; }
  for (const a of aliases) { const i = header.findIndex((h) => h.includes(a)); if (i > -1) return i; }
  return -1;
}

function num(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function parseHoldingsFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find the header row: the first row that has BOTH a symbol-like and a
  // quantity-like column. Scans the whole sheet (handles title/summary rows).
  let hi = -1, ci = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const header = r.map(norm);
    const sym = matchCol(header, ALIASES.symbol);
    const qty = matchCol(header, ALIASES.qty);
    if (sym > -1 && qty > -1) {
      hi = i;
      ci = {
        sym, qty,
        avg: matchCol(header, ALIASES.avg),
        ltp: matchCol(header, ALIASES.ltp),
        sector: matchCol(header, ALIASES.sector),
      };
      break;
    }
  }
  if (hi === -1) {
    throw new Error("Couldn't find a holdings table. Make sure the file has columns for the stock symbol and quantity.");
  }

  const out = [];
  const seen = new Set();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    let symbol = String(r[ci.sym] || "").trim().toUpperCase();
    if (!symbol) continue;
    const qty = num(r[ci.qty]);
    if (!qty) continue;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({
      symbol,
      qty,
      avg: ci.avg > -1 ? num(r[ci.avg]) : 0,
      ltp: ci.ltp > -1 ? num(r[ci.ltp]) : 0,
      sector: ci.sector > -1 ? String(r[ci.sector] || "").trim() : "",
      tier: "Medium",
    });
  }
  if (!out.length) throw new Error("No holdings rows found in this file.");
  return out;
}
