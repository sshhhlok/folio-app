import React, { useState } from "react";
import { X } from "lucide-react";
import { T, TIERS } from "../theme";
import { num } from "../lib/format";
import { Field, inputS, btnGold, iconBtn } from "./ui.jsx";

export default function HoldingForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { symbol: "", qty: "", avg: "", ltp: "", sector: "", tier: "Medium" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.symbol && f.qty !== "" && f.avg !== "" && f.ltp !== "";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000a", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, fontFamily: T.sans }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{initial ? "Edit holding" : "Add holding"}</span>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>
        <Field label="Symbol"><input value={f.symbol} onChange={set("symbol")} style={inputS} placeholder="e.g. RELIANCE" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Qty"><input value={f.qty} onChange={set("qty")} type="number" style={inputS} /></Field>
          <Field label="Avg ₹"><input value={f.avg} onChange={set("avg")} type="number" style={inputS} /></Field>
          <Field label="LTP ₹"><input value={f.ltp} onChange={set("ltp")} type="number" style={inputS} /></Field>
        </div>
        <Field label="Sector"><input value={f.sector} onChange={set("sector")} style={inputS} placeholder="e.g. Energy" /></Field>
        <Field label="Risk tier">
          <div style={{ display: "flex", gap: 8 }}>
            {Object.keys(TIERS).map((t) => (
              <button key={t} onClick={() => setF({ ...f, tier: t })} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: `1px solid ${f.tier === t ? TIERS[t] : T.border}`,
                background: f.tier === t ? TIERS[t] + "22" : "transparent",
                color: f.tier === t ? TIERS[t] : T.muted,
              }}>{t}</button>
            ))}
          </div>
        </Field>
        <button
          onClick={() => ok && onSave({ symbol: f.symbol.toUpperCase(), qty: num(f.qty), avg: num(f.avg), ltp: num(f.ltp), sector: f.sector, tier: f.tier })}
          disabled={!ok} style={{ ...btnGold, width: "100%", justifyContent: "center", marginTop: 10, opacity: ok ? 1 : 0.5 }}>
          {initial ? "Save changes" : "Add to portfolio"}
        </button>
      </div>
    </div>
  );
}
