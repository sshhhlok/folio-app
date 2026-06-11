export const num = (n) => Number(n || 0);
export const inr = (n) => "₹" + num(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const inrShort = (n) => {
  const a = Math.abs(num(n));
  if (a >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return "₹" + num(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
};
export const pct = (n) => (n >= 0 ? "+" : "") + num(n).toFixed(2) + "%";
export const today = () => new Date().toISOString().slice(0, 10);

export function withCalc(h) {
  const invested = num(h.qty) * num(h.avg);
  const value = num(h.qty) * num(h.ltp);
  const pnl = value - invested;
  return { ...h, invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0 };
}
