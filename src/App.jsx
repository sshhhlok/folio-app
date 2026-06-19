import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import {
  LayoutDashboard, ListOrdered, Plus, Pencil, Trash2, Save,
  LogOut, RefreshCw, X, PieChart as PieIcon, BarChart3, LineChart as LineIcon,
  Users, Lock, Check, IndianRupee, Upload, Sun, Moon, TrendingUp,
} from "lucide-react";

import { T, CHART, TIERS, PIE, PAYWALL, getTheme, setTheme, assetType } from "./theme";
import { supabase, configured } from "./supabaseClient";
import { inr, inrShort, pct, num, today, withCalc } from "./lib/format";
import {
  fetchHoldings, addHolding, updateHolding, deleteHolding,
  fetchSnapshots, saveSnapshot,
  fetchMyProfile, listProfiles, setProfilePaid,
  fetchJourney, saveJourney,
} from "./lib/data";
import {
  Center, Panel, Stat, Seg, Logo, Empty, btnGold, btnGhost, iconBtn, chip, tip,
} from "./components/ui.jsx";
import Login from "./components/Login.jsx";
import HoldingForm from "./components/HoldingForm.jsx";
import PromptBar from "./components/PromptBar.jsx";
import { QRCodeSVG } from "qrcode.react";
import { parseHoldingsFile } from "./lib/importZerodha";
import { parseTradebook } from "./lib/importTradebook";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!configured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    setProfile(undefined);
    fetchMyProfile(session.user.id).then(setProfile).catch(() => setProfile(null));
  }, [session]);

  if (session === undefined) return <Center><div style={{ color: T.muted, fontFamily: T.sans }}>Loading…</div></Center>;
  if (!session) return <Login />;
  if (profile === undefined) return <Center><div style={{ color: T.muted, fontFamily: T.sans }}>Loading…</div></Center>;

  const isOwner = profile?.role === "owner";
  const paidActive = profile?.is_paid && (!profile?.paid_until || profile.paid_until >= today());
  if (!isOwner && !paidActive) return <Paywall user={session.user} />;

  return <Shell user={session.user} isOwner={isOwner} />;
}

/* ── paywall (shown to unpaid, non-owner users) ───────────────────── */
function Paywall({ user }) {
  return (
    <Center>
      <div style={{ width: 360, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, fontFamily: T.sans, textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: T.gold + "22", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          <Lock size={22} color={T.gold} />
        </div>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Unlock Folio</div>
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
          Your account is ready, but access is locked until your subscription is active.
        </div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: T.mono, color: T.gold }}>{PAYWALL.price}</div>
          <div style={{ background: "#fff", padding: 12, borderRadius: 10, display: "inline-block", margin: "14px 0 6px" }}>
            <QRCodeSVG value={`upi://pay?pa=${PAYWALL.upi}&pn=Folio&am=99&cu=INR`} size={132} />
          </div>
          <div style={{ color: T.muted, fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
            Scan to pay, or send to UPI ID<br />
            <span style={{ color: T.text, fontFamily: T.mono, fontSize: 14 }}>{PAYWALL.upi}</span>
          </div>
          <div style={{ color: T.faint, fontSize: 11.5, marginTop: 10 }}>{PAYWALL.note}</div>
        </div>
        <div style={{ color: T.faint, fontSize: 11.5, marginBottom: 14 }}>Signed in as {user.email}</div>
        <button onClick={() => supabase.auth.signOut()} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </Center>
  );
}

/* ── authenticated shell ──────────────────────────────────────────── */
function Shell({ user, isOwner }) {
  const [page, setPageRaw] = useState(() => {
    try { return localStorage.getItem("folio-tab") || "dashboard"; } catch { return "dashboard"; }
  });
  const setPage = (p) => { try { localStorage.setItem("folio-tab", p); } catch {} setPageRaw(p); };
  const [theme, setThemeState] = useState(getTheme());
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); setThemeState(t); };
  const [holdings, setHoldings] = useState([]);
  const [journey, setJourney] = useState([]);
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState("pie");
  const [groupBy, setGroupBy] = useState("holding");
  const [filter, setFilter] = useState(null);
  const [form, setForm] = useState(null); // null | {} | holding
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  useEffect(() => {
    const r = () => setW(window.innerWidth); window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const mobile = w < 760;

  useEffect(() => {
    (async () => {
      try {
        const [h, s, j] = await Promise.all([fetchHoldings(user.id), fetchSnapshots(user.id), fetchJourney(user.id)]);
        setHoldings(h); setSnaps(s); setJourney(j);
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

  const handleImport = async (file) => {
    setImporting(true); setImportMsg("");
    try {
      const parsed = await parseHoldingsFile(file);
      const have = new Set(holdings.map((h) => h.symbol.toUpperCase()));
      const fresh = parsed.filter((p) => !have.has(p.symbol.toUpperCase()));
      const added = [];
      for (const p of fresh) { const a = await addHolding(user.id, p); added.push(a); }
      setHoldings((hs) => [...hs, ...added]);
      const skipped = parsed.length - added.length;
      setImportMsg(`Imported ${added.length} holding${added.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already in your list` : ""}.`);
    } catch (e) {
      setImportMsg("Couldn't read that file. Use your Zerodha Holdings download (.xlsx or .csv).");
    } finally { setImporting(false); }
  };

  const handleTradebook = async (file) => {
    setImporting(true); setImportMsg("");
    try {
      const series = await parseTradebook(file);
      const saved = await saveJourney(user.id, series);
      setJourney(saved);
      setImportMsg(`Investment journey built from ${series.length} dates.`);
    } catch (e) {
      setImportMsg("Couldn't read that file. Use your Zerodha Tradebook download (.xlsx or .csv).");
    } finally { setImporting(false); }
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
  if (isOwner) tabs.push(["admin", Users, "Admin"]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.text, paddingBottom: mobile ? 72 : 0 }}>
      {/* header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: mobile ? "13px 16px" : "15px 28px", paddingTop: mobile ? "calc(env(safe-area-inset-top) + 13px)" : "15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <button onClick={toggleTheme} style={iconBtn} aria-label="Toggle light or dark theme" title="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} style={btnGhost}><LogOut size={14} /> {mobile ? "" : "Sign out"}</button>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: mobile ? 16 : "24px 28px" }}>
        {/* summary always on top */}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <Stat label="Invested" value={inr(totals.invested)} />
          <Stat label="Current value" value={inr(totals.value)} />
          <Stat label="Total P&L" value={inr(totals.pnl)} color={totals.pnl >= 0 ? T.pos : T.neg} />
          <Stat label="Return" value={pct(totals.pnlPct)} color={totals.pnl >= 0 ? T.pos : T.neg} />
        </div>

        {page === "dashboard" && (
          rows.length === 0 ? (
            <Panel style={{ textAlign: "center", padding: mobile ? "32px 20px" : "48px 28px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: T.gold + "22", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Plus size={26} color={T.gold} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Welcome to Folio</div>
              <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 20px" }}>
                Your portfolio is empty. Add your holdings to see your value, charts and trends.
              </div>
              <button onClick={() => setForm({})} style={{ ...btnGold, margin: "0 auto" }}><Plus size={15} /> Add your first holding</button>
            </Panel>
          ) : (
            <>
              <PromptBar rows={rows} onAction={applyAction} />
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 16 }}>
                <Donut title="By asset type" data={groupSum(rows, (r) => assetType(r))} colorFor={assetColor} mobile={mobile} />
                <Donut title="By sector" data={groupSum(rows, (r) => r.sector || "Unclassified")} mobile={mobile} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Donut title="By holding" data={rows.map((r) => ({ name: r.symbol, value: r.value }))} mobile={mobile} />
              </div>
              <div style={{ marginTop: 12 }}>
                <JourneyCard journey={journey} onImport={handleTradebook} importing={importing} mobile={mobile} />
              </div>
            </>
          )
        )}

        {page === "holdings" && (
          <HoldingsPage
            rows={rows} filter={filter} setFilter={setFilter} mobile={mobile}
            onAdd={() => setForm({})} onEdit={(r) => setForm(r)} onDelete={remove}
            onRefresh={refreshPrices} refreshing={refreshing}
            onImport={handleImport} importing={importing} importMsg={importMsg}
          />
        )}

        {page === "analytics" && (
          <AnalyticsPage rows={rows} snaps={snaps} chart={chart} setChart={setChart} groupBy={groupBy} setGroupBy={setGroupBy} onSnapshot={snapshot} mobile={mobile} />
        )}

        {page === "admin" && isOwner && <AdminPage mobile={mobile} />}

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
function groupSum(rows, keyFn) {
  const m = {};
  rows.forEach((r) => { const k = keyFn(r) || "—"; m[k] = (m[k] || 0) + r.value; });
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}
const ASSET_COLORS = { Equity: "#3FB07A", ETF: "#4C7DF0", Gold: "#E0A93B", Silver: "#9AA5B4" };
const assetColor = (name, i) => ASSET_COLORS[name] || PIE[i % PIE.length];

function Donut({ title, data, mobile, colorFor }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, d) => a + d.value, 0) || 1;
  const color = (name, i) => (colorFor ? colorFor(name, i) : PIE[i % PIE.length]);
  return (
    <Panel>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 14 : 22, flexWrap: mobile ? "wrap" : "nowrap" }}>
        <div style={{ width: mobile ? "100%" : 180, height: 180, flexShrink: 0 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={sorted} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2} stroke="none">
                {sorted.map((e, i) => <Cell key={i} fill={color(e.name, i)} />)}
              </Pie>
              <RTooltip {...tip} formatter={(v) => inr(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 150, width: mobile ? "100%" : "auto" }}>
          {sorted.slice(0, 7).map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: color(d.name, i), flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              </div>
              <span style={{ fontSize: 12.5, fontFamily: T.mono, color: T.muted, flexShrink: 0, marginLeft: 8 }}>{((d.value / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
          {sorted.length > 7 && <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>+{sorted.length - 7} more</div>}
        </div>
      </div>
    </Panel>
  );
}

function JourneyCard({ journey, onImport, importing, mobile }) {
  const fileRef = useRef(null);
  const data = (journey || []).map((d) => ({ date: d.date, invested: d.invested }));
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={15} color={CHART.gold} /> Investment journey
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={btnGhost}>
          {importing ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />} {data.length ? "Update from tradebook" : "Import tradebook"}
        </button>
      </div>
      {data.length < 2
        ? <Empty text="Upload your Zerodha tradebook to chart how much you've invested over time." />
        : <div style={{ height: mobile ? 230 : 260 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={28} />
              <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} />
              <RTooltip {...tip} formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="invested" stroke={CHART.gold} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>}
    </Panel>
  );
}

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
          <RTooltip {...tip} formatter={(v) => inr(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function HoldingsPage({ rows, filter, setFilter, mobile, onAdd, onEdit, onDelete, onRefresh, refreshing, onImport, importing, importMsg }) {
  const fileRef = useRef(null);
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} style={btnGhost}>
            {importing ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />} {importing ? "Importing…" : "Import"}
          </button>
          <button onClick={onRefresh} disabled={refreshing} style={btnGhost}><RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh prices</button>
          <button onClick={onAdd} style={btnGold}><Plus size={15} /> Add</button>
        </div>
      </div>
      {importMsg && <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 10 }}>{importMsg}</div>}
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
                  <td style={tdR}>{inr(r.invested)}</td>
                  <td style={tdR}>{inr(r.value)}</td>
                  <td style={{ ...tdR, color: r.pnl >= 0 ? T.pos : T.neg }}>{inr(r.pnl)}<div style={{ fontSize: 11 }}>{pct(r.pnlPct)}</div></td>
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
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
              <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} />
              <RTooltip {...tip} formatter={(v) => inr(v)} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{rows.map((r, i) => <Cell key={i} fill={r.pnl >= 0 ? CHART.pos : CHART.neg} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {chart === "line" && (
          snaps.length < 2
            ? <Empty text="Tap “Snapshot today” on a few different days to build your value trend." />
            : <ResponsiveContainer>
              <LineChart data={snaps}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={64} domain={["auto", "auto"]} />
                <RTooltip {...tip} formatter={(v) => inr(v)} />
                <Line type="monotone" dataKey="value" stroke={CHART.gold} strokeWidth={2} dot={{ r: 3, fill: CHART.gold }} />
              </LineChart>
            </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

const tdR = { padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" };

/* ── owner admin: manage who has paid ─────────────────────────────── */
function AdminPage({ mobile }) {
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try { setUsers(await listProfiles()); }
    catch (e) { setErr("Couldn't load users. Check that the admin keys are set in Vercel."); setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (u, paid) => {
    setBusy(u.id);
    try { await setProfilePaid(u.id, paid, 30); await load(); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(""); }
  };

  const status = (u) => {
    if (u.role === "owner") return { label: "Owner", color: T.gold };
    const active = u.is_paid && (!u.paid_until || u.paid_until >= today());
    return active
      ? { label: u.paid_until ? `Active till ${u.paid_until}` : "Active", color: T.pos }
      : { label: "Inactive", color: T.neg };
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Members <span style={{ color: T.faint, fontWeight: 400 }}>· {users ? users.length : "…"}</span>
        </div>
        <button onClick={load} style={btnGhost}><RefreshCw size={14} /> Refresh</button>
      </div>
      {err && <div style={{ color: T.neg, fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <Panel pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ color: T.muted }}>
                {["Email", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i === 2 ? "right" : "left", fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u) => {
                const s = status(u);
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "11px 14px" }}>{u.email}</td>
                    <td style={{ padding: "11px 14px" }}><span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span></td>
                    <td style={{ ...tdR }}>
                      {u.role !== "owner" && (
                        s.label === "Inactive"
                          ? <button onClick={() => toggle(u, true)} disabled={busy === u.id} style={btnGold}><Check size={13} /> Activate 30d</button>
                          : <button onClick={() => toggle(u, false)} disabled={busy === u.id} style={btnGhost}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users && users.length === 0 && <tr><td colSpan={3} style={{ padding: 28, textAlign: "center", color: T.faint }}>No members yet.</td></tr>}
              {!users && <tr><td colSpan={3} style={{ padding: 28, textAlign: "center", color: T.faint }}>Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ color: T.faint, fontSize: 11.5, marginTop: 14, lineHeight: 1.6 }}>
        When a friend pays you ₹99 (via UPI), tap <b style={{ color: T.muted }}>Activate 30d</b>. Their app unlocks instantly and stays active for 30 days.
      </div>
    </>
  );
}

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const s = document.createElement("style"); s.id = "spin-kf";
  s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}";
  document.head.appendChild(s);
}
