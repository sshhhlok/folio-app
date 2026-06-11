import React, { useState } from "react";
import { Sparkles, TrendingUp, RefreshCw } from "lucide-react";
import { T } from "../theme";
import { Panel, btnGold } from "./ui.jsx";

const SCHEMA = `You control a portfolio app. The user types plain commands. Reply ONLY with JSON, no prose, no markdown fences:
{"reply":"<one short sentence>","actions":[<zero or more actions>]}
Action shapes:
{"type":"set_chart","chart":"pie|bar|line"}
{"type":"group","by":"holding|tier|sector"}
{"type":"filter","kind":"losers|gainers|tier|none","value":"<tier if kind=tier>"}
{"type":"add_holding","symbol":"X","qty":N,"avg":N,"ltp":N,"sector":"...","tier":"Safe core|Medium|High-risk"}
{"type":"delete_holding","symbol":"X"}
{"type":"goto","page":"dashboard|holdings|analytics"}
For questions about the data, compute the answer into "reply" with no actions. Tiers must be exactly: Safe core, Medium, High-risk.`;

export default function PromptBar({ rows, onAction }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");

  const run = async () => {
    if (!q.trim() || busy) return;
    setBusy(true); setReply("");
    const ctx = JSON.stringify(rows.map((r) => ({ symbol: r.symbol, qty: r.qty, avg: r.avg, ltp: r.ltp, sector: r.sector, tier: r.tier, value: Math.round(r.value), pnl: Math.round(r.pnl) })));
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: `${SCHEMA}\nCurrent holdings: ${ctx}\n\nUser: ${q}` }),
      });
      const data = await res.json();
      setReply(data.reply || "Done.");
      (data.actions || []).forEach(onAction);
      setQ("");
    } catch {
      setReply("Couldn't reach the AI service. Manual controls all work.");
    } finally { setBusy(false); }
  };

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={16} color={T.gold} style={{ flexShrink: 0 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder='Ask or command — e.g. "allocation by tier", "which are in loss"'
          style={{ flex: 1, background: "transparent", border: "none", color: T.text, fontSize: 13, outline: "none", fontFamily: T.sans, minWidth: 0 }} />
        <button onClick={run} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.6 : 1 }}>
          {busy ? <RefreshCw size={14} className="spin" /> : <TrendingUp size={14} />} Run
        </button>
      </div>
      {reply && <div style={{ color: T.muted, fontSize: 12.5, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>{reply}</div>}
    </Panel>
  );
}
