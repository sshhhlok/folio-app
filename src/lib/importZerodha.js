import * as XLSX from "xlsx";

// Reads a Zerodha "Holdings" download (.xlsx or .csv) and returns
// [{ symbol, qty, avg, ltp, sector, tier }]. Tolerant of the report's
// title/summary rows above the real table.
export async function parseHoldingsFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find the header row (the one containing "Symbol" and "Average Price").
  const hi = rows.findIndex(
    (r) => Array.isArray(r) && r.includes("Symbol") && r.includes("Average Price")
  );
  if (hi === -1) throw new Error("Could not find the holdings table in this file.");

  const header = rows[hi].map((c) => String(c).trim());
  const idx = (name) => header.indexOf(name);
  const ci = {
    sym: idx("Symbol"),
    qty: idx("Quantity Available"),
    avg: idx("Average Price"),
    ltp: idx("Previous Closing Price"),
    sector: idx("Sector"),
  };

  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const symbol = String(r[ci.sym] || "").trim();
    const qty = Number(r[ci.qty] || 0);
    if (!symbol || !qty) continue; // skip blanks / zero-qty lines
    out.push({
      symbol: symbol.toUpperCase(),
      qty,
      avg: Number(r[ci.avg] || 0),
      ltp: Number(r[ci.ltp] || 0),
      sector: ci.sector > -1 ? String(r[ci.sector] || "").trim() : "",
      tier: "Medium",
    });
  }
  if (!out.length) throw new Error("No holdings found in this file.");
  return out;
}
