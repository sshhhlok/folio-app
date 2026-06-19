import * as XLSX from "xlsx";

// Parses a Zerodha tradebook (.xlsx/.csv) into a cumulative "net invested over
// time" series: [{ date: 'YYYY-MM-DD', invested: <cumulative ₹> }].
export async function parseTradebook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const hi = rows.findIndex(
    (r) => Array.isArray(r) && r.includes("Symbol") && r.includes("Trade Type") && r.includes("Quantity")
  );
  if (hi === -1) throw new Error("Could not find the trades table in this file.");
  const header = rows[hi].map((c) => String(c).trim());
  const ci = {
    date: header.indexOf("Trade Date"),
    type: header.indexOf("Trade Type"),
    qty: header.indexOf("Quantity"),
    price: header.indexOf("Price"),
  };

  const trades = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    let d = r[ci.date];
    if (d instanceof Date) d = d.toISOString().slice(0, 10);
    else d = String(d || "").slice(0, 10);
    const type = String(r[ci.type] || "").toLowerCase();
    const qty = Number(r[ci.qty] || 0);
    const price = Number(r[ci.price] || 0);
    if (!d || !qty || !price || (type !== "buy" && type !== "sell")) continue;
    const amt = qty * price * (type === "buy" ? 1 : -1);
    trades.push({ date: d, amt });
  }
  if (!trades.length) throw new Error("No trades found in this file.");

  trades.sort((a, b) => a.date.localeCompare(b.date));
  const byDate = {};
  let cum = 0;
  for (const t of trades) { cum += t.amt; byDate[t.date] = Math.round(cum); }
  return Object.entries(byDate).map(([date, invested]) => ({ date, invested }));
}
