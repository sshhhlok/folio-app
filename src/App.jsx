import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import {
  LayoutDashboard, ListOrdered, Plus, Pencil, Trash2, Save,
  LogOut, RefreshCw, X, PieChart as PieIcon, BarChart3, LineChart as LineIcon,
} from "lucide-react";

import { T, TIERS, PIE } from "./theme";
import { supabase, configured } from "./supabaseClient";
import { inr, inrShort, pct, num, today, withCalc } from "./lib/format";
import {
  fetchHoldings, seedTemplateIfEmpty, addHolding, updateHolding, deleteHolding,
  fetchSnapshots, saveSnapshot,
} from "./lib/data";
import {
  Center, Panel, Stat, Seg, Logo, Empty, btnGold, btnGhost, iconBtn, chip, tip,
} from "./components/ui.jsx";
import Login from "./components/Login.jsx";
import HoldingForm from "./components/HoldingForm.jsx";
import PromptBar from "./components/PromptBar.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!configured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Center><div style={{ color: T.muted, fontFamily: T.sans }}>Loading…</div></Center>;
  if (!session) return <Login />;
  return <Shell user={session.user} />;
}

/* ── authenticated shell ──────────────────────────────────────────── */
function Shell({ user }) {
  const [page, setPage] = useState("dashboard");
  const [holdings, setHoldings] = useState([]);
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState("pie");
  const [groupBy, setGroupBy] = useState("holding");
  const [filter, setFilter] = useState(null);
  const [form, setForm] = useState(null); // null | {} | holding
  const [refreshing, setRefreshing] = useState(false);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  useEffect(() => {
    const r = () => setW(window.innerWidth); window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const mobile = w < 760;

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([seedTemplateIfEmpty(user.id), fetchSnapshots(user.id)]);
        setHoldings(h); setSnaps(s);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user.id]);

  const rows = useMemo(() => holdings.map(withCalc), [holdings]);
  const totals = useMemo(() => {
    const invested = rows.reduce((a, r) => a + r.invested, 0);
    const value = rows.reduce((a, r) => a + r.value, 0);
    const pnl = value - invested;
    return { invested, value, pnl, pnlPct: invested ? (pnl / invested) * 100 : 0 };
  }, [rows]);

  /* CRUD */
  const onSave = async (h) => {
    try {
      if (form && form.id) { const u = await updateHolding(form.id, h); setHoldings((hs) => hs.map((x) => x.id === u.id ? u : x)); }
      else { const a = await addHolding(user.id, h); setHoldings((hs) => [...hs, a]); }
    } catch (e) { console.error(e); }
    setForm(null);
  };
  const remove = async (id) => { try { await deleteHolding(id); setHoldings((hs) => hs.filter((x) => x.id !== id)); } catch (e) { console.error(e); } };
  const removeBySymbol = async (sym) => { const h = holdings.find((x) => x.symbol?.toUpperCase() === String(sym).toUpperCase()); if (h) await remove(h.id); };
  const addQuick = async (h) => { try { const a = await addHolding(user.id, { sector: "", tier: "Medium", ...h }); setHoldings((hs) => [...hs, a]); } catch (e) { console.error(e); } };

  const snapshot = async () => {
    const d = today(); const v = Math.round(totals.value);
    try { const s = await saveSnapshot(user.id, d, v); setSnaps((p) => [...p.filter((x) => x.date !== d), s].sort((a, b) => a.date.localeCompare(b.date))); } catch (e) { console.error(e); }
  };

  const refreshPrices = async () => {
    if (!holdings.length) return;
    setRefreshing(true);
    try {
      const syms = holdings.map((h) => h.symbol).join(",");
      const res = await fetch(`/api/quote?symbols=${encodeURIComponent(syms)}`);
      const { prices } = await res.json();
      const updates = holdings.filter((h) => prices?.[h.symbol?.toUpperCase()]);
      for (const h of updates) {
        const ltp = prices[h.symbol.toUpperCase()];
        await updateHolding(h.id, { ltp });
      }
      setHoldings((hs) => hs.map((h) => prices?.[h.symbol?.toUpperCase()] ? { ...h, ltp: prices[h.symbol.toUpperCase()] } : h));
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  const applyAction = useCallback((a) => {
    switch (a.type) {
      case "set_chart": setChart(a.chart); setPage("analytics"); break;
      case "group": setGroupBy(a.by); setChart("pie"); setPage("analytics"); break;
      case "filter": setFilter(a.kind === "none" ? null : { kind: a.kind, value: a.value }); setPage("holdings"); break;
      case "add_holding": addQuick({ symbol: String(a.symbol).toUpperCase(), qty: num(a.qty), avg: num(a.avg), ltp: num(a.ltp), sector: a.sector || "", tier: a.tier || "Medium" }); break;
      case "delete_holding": removeBySymbol(a.symbol); break;
      case "goto": setPage(a.page); break;
      default: break;
    }
  }, [holdings]);

  if (loading) return <Center><div style={{ color: T.muted, fontFamily: T.sans }}>Loading your portfolio…</div></Center>;

  const tabs = [["dashboard", LayoutDashboard, "Dashboard"], ["holdings", ListOrdered, "Holdings"], ["analytics", PieIcon, "Analytics"]];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.text, paddingBottom: mobile ? 72 : 0 }}>
      {/* header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: mobile ? "13px 16px" : "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={26} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Folio</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!mobile && tabs.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setPage(id)} style={{ ...btnGhost, border: "none", color: page === id ? T.gold : T.muted, fontWeight: page === id ? 600 : 500 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
          <button onClick={() => supabase.auth.signOut()} style={btnGhost}><LogOut size={14} /> {mobile ? "" : "Sign out"}</button>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: mobile ? 16 : "24px 28px" }}>
        {/* summary always on top */}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <Stat label="Invested" value={inrShort(totals.invested)} />
          <Stat label="Current value" value={inrShort(totals.value)} />
          <Stat label="Total P&L" value={inrShort(totals.pnl)} color={totals.pnl >= 0 ? T.pos : T.neg} />
          <Stat label="Return" value={pct(totals.pnlPct)} color={totals.pnl >= 0 ? T.pos : T.neg} />
        </div>

        {page === "dashboard" && (
          <>
            <PromptBar rows={rows} onAction={applyAction} />
            <Panel style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Allocation by holding</div>
              <AllocPie rows={rows} groupBy="holding" mobile={mobile} />
            </Panel>
          </>
        )}

        {page === "holdings" && (
          <HoldingsPage
            rows={rows} filter={filter} setFilter={setFilter} mobile={mobile}
            onAdd={() => setForm({})} onEdit={(r) => setForm(r)} onDelete={remove}
            onRefresh={refreshPrices} refreshing={refreshing}
          />
        )}

        {page === "analytics" && (
          <AnalyticsPage rows={rows} snaps={snaps} chart={chart} setChart={setChart} groupBy={groupBy} setGroupBy={setGroupBy} onSnapshot={snapshot} mobile={mobile} />
        )}

        <div style={{ color: T.faint, fontSize: 11, marginTop: 18, lineHeight: 1.6 }}>
          Signed in as {user.email}. Prices are manual unless refreshed (best-effort). Not investment advice.
        </div>
      </div>

      {/* mobile bottom nav */}
      {mobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {tabs.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setPage(id)} style={{ flex: 1, background: "transparent", border: "none", padding: "11px 0 13px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: page === id ? T.gold : T.muted, cursor: "pointer", fontFamily: T.sans }}>
              <Icon size={19} /><span style={{ fontSize: 10.5 }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {form && <HoldingForm initial={form.id ? form : null} onSave={onSave} onClose={() => setForm(null)} />}
    </div>
  );
}

/* ── pages & charts ───────────────────────────────────────────────── */
function AllocPie({ rows, groupBy, mobile }) {
  const data = useMemo(() => {
    if (groupBy === "tier" || groupBy === "sector") {
      const m = {}; rows.forEach((r) => { const k = r[groupBy] || "—"; m[k] = (m[k] || 0) + r.value; });
      return Object.entries(m).map(([name, value]) => ({ name, value }));
    }
    return rows.map((r) => ({ name: r.symbol, value: r.value }));
  }, [rows, groupBy]);
  if (!rows.length) return <div style={{ height: 280 }}><Empty text="No holdings yet." /></div>;
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={mobile ? 50 : 70} outerRadius={mobile ? 90 : 110} paddingAngle={2} stroke="none">
            {data.map((e, i) => <Cell key={i} fill={groupBy === "tier" ? (TIERS[e.name] || PIE[i % PIE.length]) : PIE[i % PIE.length]} />)}
          </Pie>
          <RTooltip {...tip} formatter={(v) => inrShort(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function HoldingsPage({ rows, filter, setFilter, mobile, onAdd, onEdit, onDelete, onRefresh, refreshing }) {
  const filtered = useMemo(() => {
    if (!filter) return rows;
    if (filter.kind === "losers") return rows.filter((r) => r.pnl < 0);
    if (filter.kind === "gainers") return rows.filter((r) => r.pnl > 0);
    if (filter.kind === "tier") return rows.filter((r) => r.tier === filter.value);
    return rows;
  }, [rows, filter]);
  const flabel = filter ? (filter.kind === "tier" ? filter.value : filter.kind[0].toUpperCase() + filter.kind.slice(1)) : "";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Holdings <span style={{ color: T.faint, fontWeight: 400 }}>· {filtered.length}</span>
          {filter && <button onClick={() => setFilter(null)} style={{ ...chip, marginLeft: 8 }}>{flabel} <X size={11} /></button>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onRefresh} disabled={refreshing} style={btnGhost}>{refreshing ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />} Refresh prices</button>
          <button onClick={onAdd} style={btnGold}><Plus size={15} /> Add</button>
        </div>
      </div>
      <Panel pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ color: T.muted }}>
                {["Symbol", "Tier", "Qty", "Avg", "LTP", "Invested", "Value", "P&L", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i <= 1 ? "left" : "right", fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontFamily: T.mono }}>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, fontFamily: T.sans }}>{r.symbol}<div style={{ color: T.faint, fontSize: 11 }}>{r.sector}</div></td>
                  <td style={{ padding: "11px 14px" }}><span style={{ ...chip, background: (TIERS[r.tier] || T.faint) + "22", color: TIERS[r.tier] || T.muted, border: "none" }}>{r.tier}</span></td>
                  <td style={tdR}>{r.qty}</td>
                  <td style={tdR}>{num(r.avg).toLocaleString("en-IN")}</td>
                  <td style={tdR}>{num(r.ltp).toLocaleString("en-IN")}</td>
                  <td style={tdR}>{inrShort(r.invested)}</td>
                  <td style={tdR}>{inrShort(r.value)}</td>
                  <td style={{ ...tdR, color: r.pnl >= 0 ? T.pos : T.neg }}>{inrShort(r.pnl)}<div style={{ fontSize: 11 }}>{pct(r.pnlPct)}</div></td>
                  <td style={{ ...tdR, whiteSpace: "nowrap" }}>
                    <button onClick={() => onEdit(r)} style={iconBtn}><Pencil size={13} /></button>
                    <button onClick={() => onDelete(r.id)} style={iconBtn}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: T.faint }}>No holdings match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function AnalyticsPage({ rows, snaps, chart, setChart, groupBy, setGroupBy, onSnapshot, mobile }) {
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <Seg options={[["pie", PieIcon, "Allocation"], ["bar", BarChart3, "P&L"], ["line", LineIcon, "Trend"]]} value={chart} onChange={setChart} />
        <div style={{ display: "flex", gap: 8 }}>
          {chart === "pie" && <Seg small options={[["holding", null, "Holding"], ["tier", null, "Tier"], ["sector", null, "Sector"]]} value={groupBy} onChange={setGroupBy} />}
          {chart === "line" && <button onClick={onSnapshot} style={btnGhost}><Save size={14} /> Snapshot today</button>}
        </div>
      </div>
      <div style={{ height: 320 }}>
        {chart === "pie" && <AllocPie rows={rows} groupBy={groupBy} mobile={mobile} />}
        {chart === "bar" && (
          <ResponsiveContainer>
            <BarChart data={rows.map((r) => ({ name: r.symbol, pnl: Math.round(r.pnl) }))}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} />
              <RTooltip {...tip} formatter={(v) => inr(v)} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{rows.map((r, i) => <Cell key={i} fill={r.pnl >= 0 ? T.pos : T.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {chart === "line" && (
          snaps.length < 2
            ? <Empty text="Tap “Snapshot today” on a few different days to build your value trend." />
            : <ResponsiveContainer>
              <LineChart data={snaps}>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} domain={["auto", "auto"]} />
                <RTooltip {...tip} formatter={(v) => inr(v)} />
                <Line type="monotone" dataKey="value" stroke={T.gold} strokeWidth={2} dot={{ r: 3, fill: T.gold }} />
              </LineChart>
            </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

const tdR = { padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" };

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const s = document.createElement("style"); s.id = "spin-kf";
  s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}";
  document.head.appendChild(s);
}
