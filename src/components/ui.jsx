import React from "react";
import { T } from "../theme";

export const inputS = { width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontSize: 15, outline: "none", fontFamily: T.sans, boxSizing: "border-box" };
export const btnGold = { display: "inline-flex", alignItems: "center", gap: 6, background: T.gold, color: T.bg, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.sans };
export const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: T.sans };
export const iconBtn = { background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 6, borderRadius: 6 };
export const chip = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px", borderRadius: 20, border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer", fontFamily: T.sans };
export const tip = { contentStyle: { background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12 }, labelStyle: { color: T.muted } };

export const Center = ({ children }) => <div style={{ minHeight: "100vh", background: T.bg, display: "grid", placeItems: "center", padding: 16 }}>{children}</div>;
export const Panel = ({ children, style, pad = 16 }) => <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: pad, ...style }}>{children}</div>;
export const Field = ({ label, children }) => <label style={{ display: "block", marginBottom: 12 }}><div style={{ color: T.muted, fontSize: 12, marginBottom: 6 }}>{label}</div>{children}</label>;
export const Empty = ({ text }) => <div style={{ height: "100%", display: "grid", placeItems: "center", color: T.faint, fontSize: 13, textAlign: "center", padding: 20 }}>{text}</div>;

export const Stat = ({ label, value, color }) => (
  <Panel pad={14}>
    <div style={{ color: T.muted, fontSize: 11.5, marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.mono, color: color || T.text }}>{value}</div>
  </Panel>
);

export function Seg({ options, value, onChange, small }) {
  return (
    <div style={{ display: "inline-flex", background: T.surface2, borderRadius: 9, padding: 3, gap: 2, flexWrap: "wrap" }}>
      {options.map(([v, Icon, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: small ? "5px 10px" : "7px 12px",
          borderRadius: 7, border: "none", cursor: "pointer", fontSize: small ? 11.5 : 12.5, fontFamily: T.sans,
          background: value === v ? T.gold : "transparent", color: value === v ? T.bg : T.muted, fontWeight: value === v ? 600 : 500,
        }}>{Icon && <Icon size={14} />}{label}</button>
      ))}
    </div>
  );
}

export function Logo({ size = 28 }) {
  return <div style={{ width: size, height: size, borderRadius: size * 0.25, background: T.gold, display: "grid", placeItems: "center", color: T.bg, fontWeight: 800, fontFamily: T.mono }}>₹</div>;
}
