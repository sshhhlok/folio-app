export const T = {
  bg: "#0E1116", surface: "#161B22", surface2: "#1C232C", border: "#262E38",
  text: "#E6E9ED", muted: "#8B95A1", faint: "#5A6573",
  gold: "#D4A84B", pos: "#3FB950", neg: "#E5534B",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
};

// Shown on the paywall to users who haven't paid yet. EDIT the upi to your own.
export const PAYWALL = {
  price: "₹99 / month",
  upi: "9559778048-4@ybl",
  note: "After paying, the owner will activate your account within a day.",
};

export const TIERS = { "Safe core": "#3FB950", "Medium": "#D4A84B", "High-risk": "#E5534B" };
export const PIE = ["#D4A84B", "#3FB950", "#5AA9E6", "#E5534B", "#B07CD6", "#E08E45", "#4DC7C0", "#9AA5B1"];

export const TEMPLATE = [
  { symbol: "NIFTYBEES", qty: 100, avg: 250, ltp: 268, sector: "Index ETF", tier: "Safe core" },
  { symbol: "HDFCBANK", qty: 20, avg: 1500, ltp: 1632, sector: "Banking", tier: "Safe core" },
  { symbol: "TATAMOTORS", qty: 30, avg: 650, ltp: 712, sector: "Auto", tier: "Medium" },
  { symbol: "GOLDBEES", qty: 80, avg: 62, ltp: 71, sector: "Commodity ETF", tier: "Medium" },
  { symbol: "IDEA", qty: 500, avg: 14, ltp: 9.8, sector: "Telecom", tier: "High-risk" },
];
