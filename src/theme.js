// Colors are CSS variables so a single [data-theme] switch flips the whole app
// instantly (light/dark) with no re-render needed.
export const T = {
  bg: "var(--c-bg)", surface: "var(--c-surface)", surface2: "var(--c-surface2)",
  border: "var(--c-border)", text: "var(--c-text)", muted: "var(--c-muted)", faint: "var(--c-faint)",
  gold: "var(--c-gold)", pos: "var(--c-pos)", neg: "var(--c-neg)",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
};

// Hard hex for chart drawing (SVG attributes don't reliably accept var()).
// These read fine on both light and dark.
export const CHART = { gold: "#C8902F", pos: "#1F9D57", neg: "#D64541", axis: "#8b95a1", grid: "rgba(128,128,128,0.18)" };

export const PAYWALL = {
  // UPI now lives in the database (Admin → Payment details) so it survives
  // every rebuild. This env value is only a last-resort fallback.
  upi: import.meta.env.VITE_UPI_ID || "",
  payee: "Folio",
  amount: 99,
  note: "After paying, the owner will activate your account within a day.",
};

export const TIERS = { "Safe core": "#1F9D57", "Medium": "#C8902F", "High-risk": "#D64541" };
export const PIE = ["#C8902F", "#1F9D57", "#378ADD", "#D64541", "#9A6DD7", "#E08E45", "#3FB0A8", "#7E8794"];

export const TEMPLATE = [];

// ── theme switching (light default) ───────────────────────────────
export function getTheme() {
  try { return document.documentElement.dataset.theme || localStorage.getItem("folio_theme") || "light"; }
  catch { return "light"; }
}
export function setTheme(t) {
  try { document.documentElement.dataset.theme = t; localStorage.setItem("folio_theme", t); } catch {}
}

// ── auto-classify a holding into an asset type for the dashboard ──
export function assetType(h) {
  const s = String(h.symbol || "").toUpperCase();
  if (/GOLD/.test(s)) return "Gold";
  if (/SILVER|SLVR/.test(s)) return "Silver";
  if (/BEES|ETF|NIFTY|SENSEX|LIQUID|GILT|BOND|SDL|GSEC|N100|MOM|MAFANG|HNGSNGBEES/.test(s)) return "ETF";
  return "Equity";
}
