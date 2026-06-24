import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, ListOrdered, Plus, Pencil, Trash2, Save,
  LogOut, RefreshCw, X, PieChart as PieIcon, BarChart3, LineChart as LineIcon,
  Users, Lock, Check, IndianRupee, Upload, Sun, Moon, TrendingUp,
  UserPlus, Calculator, Briefcase, CalendarClock, StickyNote, ChevronLeft, Cake, ChevronDown,
} from "lucide-react";

import { T, CHART, TIERS, PIE, PAYWALL, getTheme, setTheme, assetType } from "./theme";
import { supabase, configured } from "./supabaseClient";
import { inr, inrShort, pct, num, today, withCalc } from "./lib/format";
import {
  fetchHoldings, fetchAllHoldings, addHolding, updateHolding, deleteHolding,
  fetchSnapshots, saveSnapshot,
  fetchMyProfile, listProfiles, setProfilePaid, setProfilePlanPaid,
  fetchJourney, saveJourney,
  getSettings, saveSettings,
  fetchClients, addClient, updateClient, deleteClient,
  fetchNotes, addNote, deleteNote,
  fetchTasks, addTask, toggleTask, deleteTask,
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
  const [planView, setPlanViewRaw] = useState(() => { try { return localStorage.getItem("folio-plan"); } catch { return null; } });
  const setPlanView = (v) => { try { v ? localStorage.setItem("folio-plan", v) : localStorage.removeItem("folio-plan"); } catch {} setPlanViewRaw(v); };

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
  const valid = (d) => !!d && d >= today();
  const legacyBasic = profile?.is_paid && (!profile?.paid_until || profile.paid_until >= today());
  const hasBusiness = isOwner || valid(profile?.business_until);
  const hasBasic = isOwner || hasBusiness || valid(profile?.basic_until) || legacyBasic;

  const effectiveView = planView || (isOwner ? "business" : hasBusiness ? "business" : hasBasic ? "basic" : null);

  if (!isOwner && effectiveView === null) return <ChoosePackage user={session.user} onChoose={setPlanView} />;
  if (effectiveView === "basic" && !hasBasic) return <Paywall user={session.user} plan="basic" onBack={() => setPlanView(null)} />;
  if (effectiveView === "business" && !hasBusiness) return <Paywall user={session.user} plan="business" onBack={() => setPlanView(hasBasic ? "basic" : null)} />;

  return <Shell user={session.user} isOwner={isOwner} plan={effectiveView} hasBasic={hasBasic} hasBusiness={hasBusiness} onSwitchPlan={setPlanView} />;
}

/* ── choose a plan (Basic vs Business) ────────────────────────────── */
function ChoosePackage({ user, onChoose }) {
  const [s, setS] = useState(null);
  useEffect(() => { getSettings().then(setS).catch(() => setS(null)); }, []);
  const basicAmt = s?.amount ?? 99;
  const bizAmt = s?.business_amount ?? 6000;
  const basicFeatures = [
    "Your portfolio dashboard & holdings",
    "Multi-broker Excel / CSV import",
    "Holding detail: price trend, 52-week range, financials",
    "Allocation charts & investment journey",
    "Planning tools (SIP, EMI, retirement, goal…)",
    "Light & dark theme",
  ];
  const bizFeatures = [
    "Everything in Basic",
    "Manage unlimited clients",
    "Advisor dashboard with total AUM",
    "Per-client CRM: notes, tasks, reminders",
    "Birthday & anniversary reminders",
    "Family grouping",
  ];
  const Card = ({ name, price, sub, features, plan, highlight }) => (
    <div style={{ flex: 1, minWidth: 260, maxWidth: 360, background: T.surface, border: `1.5px solid ${highlight ? T.gold : T.border}`, borderRadius: 16, padding: 24, position: "relative" }}>
      {highlight && <div style={{ position: "absolute", top: -11, left: 24, background: T.gold, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>For fund managers</div>}
      <div style={{ fontSize: 16, fontWeight: 800 }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: T.mono, color: T.gold, marginTop: 6 }}>₹{Number(price).toLocaleString("en-IN")}<span style={{ fontSize: 13, color: T.muted, fontWeight: 400 }}> /month</span></div>
      <div style={{ color: T.faint, fontSize: 12.5, margin: "4px 0 16px" }}>{sub}</div>
      <div style={{ display: "grid", gap: 9, marginBottom: 20 }}>
        {features.map((f, i) => <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.text, lineHeight: 1.45 }}><Check size={15} color={T.pos} style={{ flexShrink: 0, marginTop: 1 }} /> {f}</div>)}
      </div>
      <button onClick={() => onChoose(plan)} style={{ ...(highlight ? btnGold : btnGhost), width: "100%", justifyContent: "center" }}>Choose {name}</button>
    </div>
  );
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.text, padding: "32px 18px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}><Logo size={28} /><span style={{ fontSize: 18, fontWeight: 700 }}>Folio</span></div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Choose your plan</div>
        <div style={{ color: T.muted, fontSize: 13.5, marginBottom: 26 }}>Pick the plan that fits you. You can switch anytime.</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", textAlign: "left" }}>
          <Card name="Basic" price={basicAmt} sub="For individual investors" features={basicFeatures} plan="basic" />
          <Card name="Business" price={bizAmt} sub="For advisors & fund managers" features={bizFeatures} plan="business" highlight />
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ ...btnGhost, marginTop: 24 }}><LogOut size={14} /> Sign out</button>
      </div>
    </div>
  );
}

/* ── paywall (shown to unpaid, non-owner users) ───────────────────── */
function Paywall({ user, plan = "basic", onBack }) {
  const [s, setS] = useState(null);
  useEffect(() => { getSettings().then(setS).catch(() => setS(null)); }, []);
  const upi = (s?.upi_id || PAYWALL.upi || "").trim();
  const amount = plan === "business" ? (s?.business_amount ?? 6000) : (s?.amount ?? PAYWALL.amount ?? 99);
  const payee = (s?.payee || PAYWALL.payee || "Folio").trim();
  const planName = plan === "business" ? "Business" : "Basic";
  const priceLabel = `₹${Number(amount).toLocaleString("en-IN")} / month`;
  const qrValue = upi ? `upi://pay?pa=${upi}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR` : "";
  return (
    <Center>
      <div style={{ width: 360, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, fontFamily: T.sans, textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: T.gold + "22", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          <Lock size={22} color={T.gold} />
        </div>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Unlock {planName}</div>
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
          You’ve selected the {planName} plan. Access unlocks once your subscription is active.
        </div>
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: T.mono, color: T.gold }}>{priceLabel}</div>
          {upi ? (
            <>
              <div style={{ background: "#fff", padding: 12, borderRadius: 10, display: "inline-block", margin: "14px 0 6px" }}>
                <QRCodeSVG value={qrValue} size={132} />
              </div>
              <div style={{ color: T.muted, fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
                Scan to pay, or send to UPI ID<br />
                <span style={{ color: T.text, fontFamily: T.mono, fontSize: 14 }}>{upi}</span>
              </div>
            </>
          ) : (
            <div style={{ color: T.muted, fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>
              Payment details haven’t been set up yet. Please contact the owner to pay.
            </div>
          )}
          <div style={{ color: T.faint, fontSize: 11.5, marginTop: 10 }}>{PAYWALL.note}</div>
        </div>
        <div style={{ color: T.faint, fontSize: 11.5, marginBottom: 14 }}>Signed in as {user.email}</div>
        {onBack && (
          <button onClick={onBack} style={{ ...btnGhost, width: "100%", justifyContent: "center", marginBottom: 8 }}>
            <ChevronLeft size={14} /> Change plan
          </button>
        )}
        <button onClick={() => supabase.auth.signOut()} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </Center>
  );
}

function PlanToggle({ plan, hasBusiness, onSwitch, mobile }) {
  const opt = (id, label) => (
    <button key={id} onClick={() => onSwitch(id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: T.sans, fontSize: 13, fontWeight: 600, background: plan === id ? T.gold : "transparent", color: plan === id ? "#fff" : T.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
      {label}{id === "business" && !hasBusiness && <Lock size={12} />}
    </button>
  );
  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, width: mobile ? "100%" : 300 }}>
        {opt("basic", "Basic")}
        {opt("business", "Business")}
      </div>
      <span style={{ fontSize: 12, color: T.muted }}>{plan === "business" ? "Advisor mode — manage clients" : "Personal mode"}</span>
    </div>
  );
}

/* ── authenticated shell ──────────────────────────────────────────── */
function Shell({ user, isOwner, plan, hasBusiness, onSwitchPlan }) {
  const [page, setPageRaw] = useState(() => {
    try { return localStorage.getItem("folio-tab") || "dashboard"; } catch { return "dashboard"; }
  });
  const setPage = (p) => { try { localStorage.setItem("folio-tab", p); } catch {} setPageRaw(p); };
  const [theme, setThemeState] = useState(getTheme());
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); setThemeState(t); };
  const [holdings, setHoldings] = useState([]);
  const [journey, setJourney] = useState([]);
  const [snaps, setSnaps] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [clientId, setClientIdRaw] = useState(() => { try { return localStorage.getItem("folio-client") || null; } catch { return null; } });
  const setClientId = (id) => { try { id ? localStorage.setItem("folio-client", id) : localStorage.removeItem("folio-client"); } catch {} setClientIdRaw(id); };
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState("pie");
  const [groupBy, setGroupBy] = useState("holding");
  const [filter, setFilter] = useState(null);
  const [form, setForm] = useState(null); // null | {} | holding
  const [detail, setDetail] = useState(null); // holding being inspected
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [clientErr, setClientErr] = useState("");
  const importRef = useRef(null);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  useEffect(() => {
    const r = () => setW(window.innerWidth); window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const mobile = w < 760;

  // Load the advisor's client book once. Basic users get one auto-created
  // "My Portfolio" so they have a single portfolio without touching clients.
  useEffect(() => {
    (async () => {
      try {
        let cs = await fetchClients(user.id);
        if (plan === "basic" && cs.length === 0) { const c = await addClient(user.id, { name: "My Portfolio" }); cs = [c]; }
        setClients(cs);
        setClientIdRaw((cur) => (cur && cs.some((c) => c.id === cur)) ? cur : (cs[0]?.id || null));
      } catch (e) { console.error("clients", e); }
      finally { setClientsLoaded(true); }
    })();
  }, [user.id, plan]);

  // If the active tab isn't allowed on this plan, fall back to dashboard.
  useEffect(() => {
    const allowed = ["dashboard", "holdings", "analytics", "tools", ...(plan === "business" ? ["clients"] : []), ...(isOwner ? ["admin"] : [])];
    if (!allowed.includes(page)) setPage("dashboard");
  }, [plan]);

  // Load the selected client's portfolio. Each source loads independently so
  // one failure can't wipe the others.
  useEffect(() => {
    if (!clientsLoaded) return;
    if (!clientId) { setHoldings([]); setSnaps([]); setJourney([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      try { setHoldings(await fetchHoldings(clientId)); } catch (e) { console.error("holdings", e); }
      try { setSnaps(await fetchSnapshots(clientId)); } catch (e) { console.error("snaps", e); }
      try { setJourney(await fetchJourney(clientId)); } catch (e) { console.error("journey", e); }
      setLoading(false);
    })();
  }, [clientId, clientsLoaded]);

  const activeClient = useMemo(() => clients.find((c) => c.id === clientId) || null, [clients, clientId]);

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
      else { const cid = clientId || await ensureClient(); if (!cid) return; const a = await addHolding(user.id, cid, h); setHoldings((hs) => [...hs, a]); }
    } catch (e) { console.error(e); }
    setForm(null);
  };
  const remove = async (id) => { try { await deleteHolding(id); setHoldings((hs) => hs.filter((x) => x.id !== id)); } catch (e) { console.error(e); } };
  const removeMany = async (ids) => {
    try { for (const id of ids) await deleteHolding(id); setHoldings((hs) => hs.filter((x) => !ids.includes(x.id))); } catch (e) { console.error(e); }
  };
  const saveClient = async (c) => {
    try {
      if (c.id) { const u = await updateClient(c.id, c); setClients((cs) => cs.map((x) => x.id === u.id ? u : x).sort((a, b) => a.name.localeCompare(b.name))); return u; }
      const a = await addClient(user.id, c); setClients((cs) => [...cs, a].sort((x, y) => x.name.localeCompare(y.name))); setClientId(a.id); return a;
    } catch (e) { console.error(e); }
  };
  const removeClient = async (id) => {
    try { await deleteClient(id); setClients((cs) => cs.filter((x) => x.id !== id)); if (clientId === id) setClientId(null); } catch (e) { console.error(e); }
  };
  // Guarantees a client exists to attach holdings to (used by Basic plan).
  const ensureClient = async () => {
    if (clientId) return clientId;
    setClientErr("");
    try { const c = await addClient(user.id, { name: "My Portfolio" }); setClients((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name))); setClientId(c.id); return c.id; }
    catch (e) { console.error(e); setClientErr(`Couldn't set up your portfolio: ${e?.message || e}. Run schema_all.sql in Supabase, then reload.`); return null; }
  };
  const removeBySymbol = async (sym) => { const h = holdings.find((x) => x.symbol?.toUpperCase() === String(sym).toUpperCase()); if (h) await remove(h.id); };
  const addQuick = async (h) => { try { const cid = clientId || await ensureClient(); if (!cid) return; const a = await addHolding(user.id, cid, { sector: "", tier: "Medium", ...h }); setHoldings((hs) => [...hs, a]); } catch (e) { console.error(e); } };

  const snapshot = async () => {
    const d = today(); const v = Math.round(totals.value);
    try { const cid = clientId || await ensureClient(); if (!cid) return; const s = await saveSnapshot(user.id, cid, d, v); setSnaps((p) => [...p.filter((x) => x.date !== d), s].sort((a, b) => a.date.localeCompare(b.date))); } catch (e) { console.error(e); }
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
      const cid = clientId || await ensureClient();
      if (!cid) { setImportMsg("Couldn't prepare your portfolio. Run schema_advisor.sql in Supabase."); return; }
      const have = new Set(holdings.map((h) => h.symbol.toUpperCase()));
      const fresh = parsed.filter((p) => !have.has(p.symbol.toUpperCase()));
      const added = [];
      for (const p of fresh) { const a = await addHolding(user.id, cid, p); added.push(a); }
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
      const cid = clientId || await ensureClient(); if (!cid) return;
      const saved = await saveJourney(user.id, cid, series);
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

  if (!clientsLoaded) return <Center><div style={{ color: T.muted, fontFamily: T.sans }}>Loading…</div></Center>;

  const tabs = [["dashboard", LayoutDashboard, "Dashboard"], ["holdings", ListOrdered, "Holdings"], ["analytics", PieIcon, "Analytics"]];
  if (plan === "business") tabs.push(["clients", Briefcase, "Clients"]);
  tabs.push(["tools", Calculator, "Tools"]);
  if (isOwner) tabs.push(["admin", Users, "Admin"]);
  const portfolioPage = page === "dashboard" || page === "holdings" || page === "analytics";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.text, paddingBottom: mobile ? 72 : 0 }}>
      {/* header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: mobile ? "13px 16px" : "15px 28px", paddingTop: mobile ? "calc(env(safe-area-inset-top) + 13px)" : "15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={26} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Folio</span>
          {plan === "business" && clients.length > 0 && (
            <div style={{ position: "relative", display: "flex", alignItems: "center", marginLeft: 4 }}>
              <span style={{ color: T.faint, marginRight: 8 }}>·</span>
              <Briefcase size={14} color={T.muted} />
              <select value={clientId || ""} onChange={(e) => { setClientId(e.target.value || null); if (!portfolioPage) setPage("dashboard"); }}
                style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", border: "none", color: T.text, fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, padding: "4px 18px 4px 6px", cursor: "pointer", maxWidth: mobile ? 130 : 220, textOverflow: "ellipsis" }}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} color={T.muted} style={{ marginLeft: -16, pointerEvents: "none" }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!mobile && tabs.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setPage(id)} style={{ ...btnGhost, border: "none", color: page === id ? T.gold : T.muted, fontWeight: page === id ? 600 : 500 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
          <button onClick={() => onSwitchPlan(plan === "business" ? "basic" : "business")} title="Switch plan"
            style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", fontFamily: T.sans }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: plan === "business" ? T.gold : T.muted }}>{plan === "business" ? "Business" : "Basic"}</span>
            <span style={{ width: 38, height: 22, borderRadius: 11, background: plan === "business" ? T.gold : T.border, position: "relative", flexShrink: 0, transition: "background .15s" }}>
              <span style={{ position: "absolute", top: 2, left: plan === "business" ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
            </span>
          </button>
          <button onClick={toggleTheme} style={iconBtn} aria-label="Toggle light or dark theme" title="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} style={btnGhost}><LogOut size={14} /> {mobile ? "" : "Sign out"}</button>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: mobile ? 16 : "24px 28px" }}>
        {portfolioPage && clientId && (
          <>
            {!mobile && <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>{activeClient?.name}</div>}
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              <Stat label="Invested" value={inr(totals.invested)} />
              <Stat label="Current value" value={inr(totals.value)} />
              <Stat label="Total P&L" value={inr(totals.pnl)} color={totals.pnl >= 0 ? T.pos : T.neg} />
              <Stat label="Return" value={pct(totals.pnlPct)} color={totals.pnl >= 0 ? T.pos : T.neg} />
            </div>
          </>
        )}

        {portfolioPage && !clientId && (
          <Panel style={{ textAlign: "center", padding: mobile ? "32px 20px" : "48px 28px" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: T.gold + "22", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <Briefcase size={26} color={T.gold} />
            </div>
            {plan === "business" ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No client selected</div>
                <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 20px" }}>
                  Add your first client to start tracking a portfolio. Each client gets their own holdings, charts and journey.
                </div>
                <button onClick={() => setPage("clients")} style={{ ...btnGold, margin: "0 auto" }}><UserPlus size={15} /> Go to Clients</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Set up your portfolio</div>
                <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 20px" }}>
                  Import your broker file (Zerodha, Groww, Upstox…) or add holdings manually.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
                  <button onClick={() => importRef.current?.click()} disabled={importing} style={btnGold}>
                    {importing ? <RefreshCw size={14} className="spin" /> : <Upload size={15} />} {importing ? "Importing…" : "Import holdings"}
                  </button>
                  <button onClick={() => setForm({})} style={btnGhost}><Plus size={15} /> Add manually</button>
                </div>
                {(clientErr || importMsg) && <div style={{ color: clientErr ? T.neg : T.muted, fontSize: 12, marginTop: 14, lineHeight: 1.5, maxWidth: 380, marginInline: "auto" }}>{clientErr || importMsg}</div>}
              </>
            )}
          </Panel>
        )}

        {portfolioPage && clientId && loading && <Panel><Empty text="Loading…" /></Panel>}

        {clientId && !loading && page === "dashboard" && (
          rows.length === 0 ? (
            <Panel style={{ textAlign: "center", padding: mobile ? "32px 20px" : "48px 28px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: T.gold + "22", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <Plus size={26} color={T.gold} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{activeClient?.name}’s portfolio is empty</div>
              <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 20px" }}>
                Add holdings or import a broker file to see value, charts and trends.
              </div>
              <button onClick={() => setForm({})} style={{ ...btnGold, margin: "0 auto" }}><Plus size={15} /> Add first holding</button>
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

        {clientId && !loading && page === "holdings" && (
          <HoldingsPage
            rows={rows} filter={filter} setFilter={setFilter} mobile={mobile}
            onAdd={() => setForm({})} onEdit={(r) => setForm(r)} onDelete={remove} onDeleteMany={removeMany} onView={setDetail}
            onRefresh={refreshPrices} refreshing={refreshing}
            onImport={handleImport} importing={importing} importMsg={importMsg}
          />
        )}

        {clientId && !loading && page === "analytics" && (
          <AnalyticsPage rows={rows} snaps={snaps} chart={chart} setChart={setChart} groupBy={groupBy} setGroupBy={setGroupBy} onSnapshot={snapshot} mobile={mobile} />
        )}

        {plan === "business" && page === "clients" && (
          <ClientsPage user={user} clients={clients} clientId={clientId} setClientId={setClientId}
            onSave={saveClient} onRemove={removeClient} goPortfolio={() => setPage("dashboard")} mobile={mobile} />
        )}

        {page === "tools" && <ToolsPage mobile={mobile} />}

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
      {detail && <HoldingDetail row={detail} onClose={() => setDetail(null)} mobile={mobile} />}
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

function HoldingsPage({ rows, filter, setFilter, mobile, onAdd, onEdit, onDelete, onDeleteMany, onView, onRefresh, refreshing, onImport, importing, importMsg }) {
  const fileRef = useRef(null);
  const [sel, setSel] = useState(() => new Set());
  const filtered = useMemo(() => {
    if (!filter) return rows;
    if (filter.kind === "losers") return rows.filter((r) => r.pnl < 0);
    if (filter.kind === "gainers") return rows.filter((r) => r.pnl > 0);
    if (filter.kind === "tier") return rows.filter((r) => r.tier === filter.value);
    return rows;
  }, [rows, filter]);
  const flabel = filter ? (filter.kind === "tier" ? filter.value : filter.kind[0].toUpperCase() + filter.kind.slice(1)) : "";

  const allSel = filtered.length > 0 && filtered.every((r) => sel.has(r.id));
  const toggleOne = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(() => allSel ? new Set() : new Set(filtered.map((r) => r.id)));
  const deleteSelected = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${ids.length} holding${ids.length === 1 ? "" : "s"}?`)) return;
    await onDeleteMany(ids); setSel(new Set());
  };
  const cbStyle = { width: 16, height: 16, accentColor: "#C8902F", cursor: "pointer" };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Holdings <span style={{ color: T.faint, fontWeight: 400 }}>· {filtered.length}</span>
          {filter && <button onClick={() => setFilter(null)} style={{ ...chip, marginLeft: 8 }}>{flabel} <X size={11} /></button>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sel.size > 0 && (
            <button onClick={deleteSelected} style={{ ...btnGhost, color: T.neg, borderColor: T.neg + "55" }}>
              <Trash2 size={14} /> Delete selected ({sel.size})
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} style={btnGhost}>
            {importing ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />} {importing ? "Importing…" : "Import"}
          </button>
          <button onClick={onRefresh} disabled={refreshing} style={btnGhost}><RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh prices</button>
          <button onClick={onAdd} style={btnGold}><Plus size={15} /> Add</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.faint, fontSize: 12, marginBottom: 10 }}>
        <LineIcon size={13} /> Tap a holding’s name for its detailed view — price trend, 52-week range and more.
      </div>
      {importMsg && <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 10 }}>{importMsg}</div>}
      <Panel pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ color: T.muted }}>
                <th style={{ padding: "11px 10px 11px 14px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 36 }}>
                  <input type="checkbox" checked={allSel} onChange={toggleAll} style={cbStyle} aria-label="Select all" />
                </th>
                {["Symbol", "Tier", "Qty", "Avg", "LTP", "Invested", "Value", "P&L", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i <= 1 ? "left" : "right", fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontFamily: T.mono }}>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}`, background: sel.has(r.id) ? T.gold + "11" : "transparent" }}>
                  <td style={{ padding: "11px 10px 11px 14px" }}>
                    <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleOne(r.id)} style={cbStyle} aria-label={`Select ${r.symbol}`} />
                  </td>
                  <td style={{ padding: "11px 14px", fontWeight: 600, fontFamily: T.sans }}>
                    <button onClick={() => onView(r)} style={{ background: "none", border: "none", padding: 0, color: T.text, fontWeight: 600, fontFamily: T.sans, cursor: "pointer", fontSize: 13 }}>{r.symbol}</button>
                    <div style={{ color: T.faint, fontSize: 11 }}>{r.sector}</div>
                  </td>
                  <td style={{ padding: "11px 14px" }}><span style={{ ...chip, background: (TIERS[r.tier] || T.faint) + "22", color: TIERS[r.tier] || T.muted, border: "none" }}>{r.tier}</span></td>
                  <td style={tdR}>{r.qty}</td>
                  <td style={tdR}>{num(r.avg).toLocaleString("en-IN")}</td>
                  <td style={tdR}>{num(r.ltp).toLocaleString("en-IN")}</td>
                  <td style={tdR}>{inr(r.invested)}</td>
                  <td style={tdR}>{inr(r.value)}</td>
                  <td style={{ ...tdR, color: r.pnl >= 0 ? T.pos : T.neg }}>{inr(r.pnl)}<div style={{ fontSize: 11 }}>{pct(r.pnlPct)}</div></td>
                  <td style={{ ...tdR, whiteSpace: "nowrap" }}>
                    <button onClick={() => onView(r)} style={iconBtn} title="Details"><LineIcon size={13} /></button>
                    <button onClick={() => onEdit(r)} style={iconBtn}><Pencil size={13} /></button>
                    <button onClick={() => onDelete(r.id)} style={iconBtn}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: 28, textAlign: "center", color: T.faint }}>No holdings match.</td></tr>}
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

function HoldingDetail({ row, onClose, mobile }) {
  const [d, setD] = useState(undefined); // undefined=loading, null=failed, obj=ok
  useEffect(() => {
    let alive = true; setD(undefined);
    fetch(`/api/detail?symbol=${encodeURIComponent(row.symbol)}`)
      .then((r) => r.json()).then((j) => { if (alive) setD(j && j.ok ? j : null); })
      .catch(() => { if (alive) setD(null); });
    return () => { alive = false; };
  }, [row.symbol]);

  const avg = num(row.avg);
  const live = d && typeof d.price === "number" ? d.price : num(row.ltp);
  const invested = avg * num(row.qty);
  const value = live * num(row.qty);
  const pnl = value - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;

  const w52L = d?.week52Low, w52H = d?.week52High;
  const rangePos = (v) => (w52L != null && w52H != null && w52H > w52L) ? Math.max(0, Math.min(100, ((v - w52L) / (w52H - w52L)) * 100)) : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: mobile ? "16px 16px 0 0" : 16, padding: mobile ? 18 : 24, fontFamily: T.sans }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: T.text }}>{row.symbol}</div>
            <div style={{ fontSize: 12.5, color: T.faint }}>{row.sector || "—"}{d?.exchange ? ` · ${d.exchange}` : ""}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
          <Stat label="Your avg" value={inr(avg)} />
          <Stat label="Current" value={inr(live)} />
          <Stat label="P&L" value={inr(pnl)} color={pnl >= 0 ? T.pos : T.neg} />
          <Stat label="Return" value={pct(pnlPct)} color={pnl >= 0 ? T.pos : T.neg} />
        </div>

        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>
            About · {assetType(row) === "Equity" ? "Stock" : assetType(row)}{row.sector ? ` · ${row.sector}` : ""}{d?.exchange ? ` · ${d.exchange}` : ""}
          </div>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>
            {d === undefined ? "Loading…"
              : (d && d.about) ? d.about
              : `${row.symbol} is ${assetType(row) === "ETF" ? "an exchange-traded fund" : "a listed " + (row.sector ? row.sector + " " : "") + "company"} in your portfolio. A detailed description isn’t available from the feed right now.`}
          </div>
        </div>

        {d === undefined && <Empty text="Loading price history…" />}
        {d === null && (
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
            Live price history isn’t available right now (the feed is best-effort and may be temporarily down, or this scrip isn’t covered). Your entry vs current figures above are still accurate.
          </div>
        )}

        {d && d.ok && (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Price (1 year) vs your buy price</div>
            <div style={{ height: 240, marginBottom: 8 }}>
              <ResponsiveContainer>
                <LineChart data={d.history}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={40} />
                  <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={60} domain={["auto", "auto"]} />
                  <RTooltip {...tip} formatter={(v) => inr(v)} />
                  <ReferenceLine y={avg} stroke={CHART.gold} strokeDasharray="5 4" />
                  <Line type="monotone" dataKey="close" stroke={CHART.pos} strokeWidth={2} dot={false} name="Price" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: T.muted, marginBottom: 18 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 2, background: CHART.pos }} /> Market price</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${CHART.gold}` }} /> Your avg ({inr(avg)})</span>
            </div>

            {w52L != null && w52H != null && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>52-week range</div>
                <div style={{ position: "relative", height: 8, borderRadius: 4, background: T.surface2, marginBottom: 8 }}>
                  {rangePos(live) != null && <span style={{ position: "absolute", left: `${rangePos(live)}%`, top: -4, width: 3, height: 16, background: CHART.pos, transform: "translateX(-50%)" }} />}
                  {rangePos(avg) != null && <span style={{ position: "absolute", left: `${rangePos(avg)}%`, top: -4, width: 3, height: 16, background: CHART.gold, transform: "translateX(-50%)" }} />}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
                  <span>Low {inr(w52L)}</span><span>High {inr(w52H)}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: T.muted, marginTop: 12, flexWrap: "wrap" }}>
                  {d.allTimeLow != null && <span>All-time low: <b style={{ color: T.text }}>{inr(d.allTimeLow)}</b></span>}
                  {d.allTimeHigh != null && <span>All-time high: <b style={{ color: T.text }}>{inr(d.allTimeHigh)}</b></span>}
                </div>
              </div>
            )}

            {d.financials && d.financials.length > 0 && (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Financials (last quarters)</div>
                <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: T.muted, marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: CHART.gold }} /> Revenue</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: CHART.pos }} /> Earnings</span>
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={d.financials}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                      <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={inrShort} width={56} />
                      <RTooltip {...tip} formatter={(v) => inr(v)} />
                      <Bar dataKey="revenue" name="Revenue" fill={CHART.gold} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="earnings" name="Earnings" fill={CHART.pos} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const tdR = { padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" };

function upcomingBirthday(dob) {
  if (!dob) return null;
  const d = new Date(dob); if (isNaN(d)) return null;
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < todayD) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  const days = Math.round((next - todayD) / 86400000);
  if (days > 30) return null;
  const dd = next.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (days === 0) return `Birthday today (${dd})!`;
  return `Birthday in ${days} day${days === 1 ? "" : "s"} (${dd})`;
}

const cField = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontFamily: T.sans, fontSize: 13.5, outline: "none" };
const cLbl = { fontSize: 12, color: T.muted, marginBottom: 4, display: "block" };

function ClientForm({ initial, onSave, onClose, mobile }) {
  const [c, setC] = useState(initial || { name: "", email: "", phone: "", pan: "", dob: "", family_group: "", nominee: "", risk_profile: "", notes: "" });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const submit = () => { if (!c.name.trim()) return; const payload = { ...c, dob: c.dob || null }; if (initial?.id) payload.id = initial.id; onSave(payload); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: mobile ? "16px 16px 0 0" : 16, padding: mobile ? 18 : 24, fontFamily: T.sans }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{initial?.id ? "Edit client" : "New client"}</div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={cLbl}>Name *</label><input style={cField} value={c.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label style={cLbl}>Email</label><input style={cField} value={c.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label style={cLbl}>Phone</label><input style={cField} value={c.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label style={cLbl}>PAN</label><input style={cField} value={c.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} /></div>
          <div><label style={cLbl}>Date of birth</label><input type="date" style={cField} value={c.dob || ""} onChange={(e) => set("dob", e.target.value)} /></div>
          <div><label style={cLbl}>Family group</label><input style={cField} value={c.family_group} onChange={(e) => set("family_group", e.target.value)} placeholder="e.g. Sharma family" /></div>
          <div><label style={cLbl}>Nominee</label><input style={cField} value={c.nominee} onChange={(e) => set("nominee", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={cLbl}>Risk profile</label>
            <select style={cField} value={c.risk_profile} onChange={(e) => set("risk_profile", e.target.value)}>
              <option value="">—</option><option>Conservative</option><option>Moderate</option><option>Aggressive</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label style={cLbl}>Profile note</label><input style={cField} value={c.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} style={btnGold}><Save size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}

function ClientCRM({ user, clientId, mobile }) {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [nb, setNb] = useState("");
  const [tt, setTt] = useState(""); const [td, setTd] = useState("");
  useEffect(() => {
    fetchNotes(clientId).then(setNotes).catch(() => setNotes([]));
    fetchTasks(user.id).then((all) => setTasks(all.filter((t) => t.client_id === clientId))).catch(() => setTasks([]));
  }, [clientId, user.id]);
  const addN = async () => { if (!nb.trim()) return; try { const n = await addNote(user.id, clientId, nb.trim()); setNotes((x) => [n, ...x]); setNb(""); } catch (e) { console.error(e); } };
  const delN = async (id) => { try { await deleteNote(id); setNotes((x) => x.filter((n) => n.id !== id)); } catch (e) { console.error(e); } };
  const addT = async () => { if (!tt.trim()) return; try { const t = await addTask(user.id, clientId, tt.trim(), td || null); setTasks((x) => [...x, t]); setTt(""); setTd(""); } catch (e) { console.error(e); } };
  const togT = async (t) => { try { const u = await toggleTask(t.id, !t.done); setTasks((x) => x.map((y) => y.id === u.id ? u : y)); } catch (e) { console.error(e); } };
  const delT = async (id) => { try { await deleteTask(id); setTasks((x) => x.filter((y) => y.id !== id)); } catch (e) { console.error(e); } };
  return (
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
      <Panel>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><CalendarClock size={15} /> Tasks & reminders</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <input value={tt} onChange={(e) => setTt(e.target.value)} placeholder="e.g. Call about SIP" style={{ ...cField, flex: 2, minWidth: 120 }} />
          <input value={td} onChange={(e) => setTd(e.target.value)} type="date" style={{ ...cField, flex: 1, minWidth: 120 }} />
          <button onClick={addT} style={btnGhost}><Plus size={14} /></button>
        </div>
        {tasks.length === 0 ? <Empty text="No tasks." /> : tasks.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
            <input type="checkbox" checked={t.done} onChange={() => togT(t)} style={{ width: 16, height: 16, accentColor: "#C8902F" }} />
            <div style={{ flex: 1, fontSize: 13, textDecoration: t.done ? "line-through" : "none", color: t.done ? T.faint : T.text }}>{t.title}{t.due_date ? <span style={{ color: T.faint, fontSize: 11.5 }}> · {t.due_date}</span> : null}</div>
            <button onClick={() => delT(t.id)} style={iconBtn}><X size={13} /></button>
          </div>
        ))}
      </Panel>
      <Panel>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><StickyNote size={15} /> Notes</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input value={nb} onChange={(e) => setNb(e.target.value)} placeholder="Meeting note…" style={{ ...cField, flex: 1 }} />
          <button onClick={addN} style={btnGhost}><Plus size={14} /></button>
        </div>
        {notes.length === 0 ? <Empty text="No notes yet." /> : notes.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 8, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
            <div style={{ flex: 1, fontSize: 13, color: T.text, lineHeight: 1.5 }}>{n.body}<div style={{ color: T.faint, fontSize: 10.5, marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString("en-IN")}</div></div>
            <button onClick={() => delN(n.id)} style={iconBtn}><X size={13} /></button>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function ClientDetail({ user, client, stats, onBack, onEdit, onRemove, onOpenPortfolio, mobile }) {
  const v = stats || { value: 0, invested: 0 };
  const pnl = v.value - v.invested;
  const bday = upcomingBirthday(client.dob);
  return (
    <>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}><ChevronLeft size={15} /> All clients</button>
      <Panel style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{client.name}</div>
            <div style={{ color: T.faint, fontSize: 12.5, marginTop: 2 }}>{[client.family_group, client.risk_profile].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onEdit} style={btnGhost}><Pencil size={14} /> Edit</button>
            <button onClick={onOpenPortfolio} style={btnGold}><Briefcase size={14} /> Open portfolio</button>
          </div>
        </div>
        {bday && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: T.gold + "18", color: T.gold, padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}><Cake size={15} /> {bday}</div>}
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginTop: 14 }}>
          <Stat label="Value" value={inr(v.value)} />
          <Stat label="Invested" value={inr(v.invested)} />
          <Stat label="P&L" value={inr(pnl)} color={pnl >= 0 ? T.pos : T.neg} />
          <Stat label="PAN" value={client.pan || "—"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 12, fontSize: 12.5, color: T.muted }}>
          <div>Email: <span style={{ color: T.text }}>{client.email || "—"}</span></div>
          <div>Phone: <span style={{ color: T.text }}>{client.phone || "—"}</span></div>
          <div>Nominee: <span style={{ color: T.text }}>{client.nominee || "—"}</span></div>
          <div>DOB: <span style={{ color: T.text }}>{client.dob || "—"}</span></div>
        </div>
        {client.notes && <div style={{ marginTop: 12, fontSize: 12.5, color: T.muted }}>Note: <span style={{ color: T.text }}>{client.notes}</span></div>}
        <div style={{ marginTop: 14 }}>
          <button onClick={onRemove} style={{ ...btnGhost, color: T.neg, borderColor: T.neg + "55" }}><Trash2 size={14} /> Delete client</button>
        </div>
      </Panel>
      <ClientCRM user={user} clientId={client.id} mobile={mobile} />
    </>
  );
}

function ClientsPage({ user, clients, clientId, setClientId, onSave, onRemove, goPortfolio, mobile }) {
  const [allH, setAllH] = useState([]);
  const [detail, setDetail] = useState(null);
  const [formC, setFormC] = useState(null);
  useEffect(() => { fetchAllHoldings(user.id).then(setAllH).catch(() => setAllH([])); }, [user.id]);

  const valByClient = useMemo(() => {
    const m = {};
    allH.forEach((h) => { const r = withCalc(h); const k = h.client_id; if (!k) return; m[k] = m[k] || { value: 0, invested: 0 }; m[k].value += r.value; m[k].invested += r.invested; });
    return m;
  }, [allH]);
  const aum = useMemo(() => Object.values(valByClient).reduce((a, v) => a + v.value, 0), [valByClient]);

  const save = async (c) => { const saved = await onSave(c); setFormC(null); if (saved && detail && detail.id === saved.id) setDetail(saved); };

  if (detail) return (
    <>
      <ClientDetail user={user} client={detail} stats={valByClient[detail.id]} mobile={mobile}
        onBack={() => setDetail(null)} onEdit={() => setFormC(detail)}
        onRemove={async () => { await onRemove(detail.id); setDetail(null); }}
        onOpenPortfolio={() => { setClientId(detail.id); goPortfolio(); }} />
      {formC && <ClientForm initial={formC.id ? formC : null} onSave={save} onClose={() => setFormC(null)} mobile={mobile} />}
    </>
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
        <Stat label="Total AUM" value={inr(aum)} />
        <Stat label="Clients" value={String(clients.length)} />
        <Stat label="Avg / client" value={inr(clients.length ? aum / clients.length : 0)} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Clients</div>
        <button onClick={() => setFormC({})} style={btnGold}><UserPlus size={15} /> Add client</button>
      </div>
      {clients.length === 0 ? <Panel><Empty text="No clients yet. Add your first client to begin." /></Panel> : (
        <Panel pad={0}>
          {clients.map((c, i) => {
            const v = valByClient[c.id] || { value: 0, invested: 0 };
            const pnl = v.value - v.invested;
            return (
              <button key={c.id} onClick={() => setDetail(c)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 16px", background: c.id === clientId ? T.gold + "11" : "transparent", border: "none", borderTop: i ? `1px solid ${T.border}` : "none", cursor: "pointer", textAlign: "left", fontFamily: T.sans, color: T.text }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ color: T.faint, fontSize: 11.5 }}>{c.family_group ? c.family_group + " · " : ""}{c.pan || c.email || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: T.mono, fontSize: 13.5 }}>{inr(v.value)}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 11.5, color: pnl >= 0 ? T.pos : T.neg }}>{inr(pnl)}</div>
                </div>
              </button>
            );
          })}
        </Panel>
      )}
      {formC && <ClientForm initial={formC.id ? formC : null} onSave={save} onClose={() => setFormC(null)} mobile={mobile} />}
    </>
  );
}

function CalcCard({ title, fields, compute, note }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.k, f.def])));
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  let result;
  try { result = compute(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parseFloat(x) || 0]))); } catch { result = null; }
  return (
    <Panel>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {fields.map((f) => (
          <div key={f.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ flex: 1, fontSize: 12.5, color: T.muted }}>{f.label}</label>
            <input type="number" value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} style={{ ...cField, width: 120, fontFamily: T.mono, fontSize: 13 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: T.muted }}>{note}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: T.gold, fontFamily: T.mono }}>{result == null || !isFinite(result) ? "—" : inr(Math.round(result))}</span>
      </div>
    </Panel>
  );
}

function ToolsPage({ mobile }) {
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Planning tools</div>
      <div style={{ color: T.faint, fontSize: 12.5, marginBottom: 16 }}>Quick calculators — estimates only, not advice.</div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <CalcCard title="SIP future value" note="Maturity value"
          fields={[{ k: "monthly", label: "Monthly invest (₹)", def: 10000 }, { k: "years", label: "Years", def: 10 }, { k: "rate", label: "Return % p.a.", def: 12 }]}
          compute={(v) => { const i = v.rate / 1200, n = v.years * 12; return i ? v.monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : v.monthly * n; }} />
        <CalcCard title="Goal — required SIP" note="Monthly SIP needed"
          fields={[{ k: "target", label: "Target (₹)", def: 5000000 }, { k: "years", label: "Years", def: 15 }, { k: "rate", label: "Return % p.a.", def: 12 }]}
          compute={(v) => { const i = v.rate / 1200, n = v.years * 12; const f = i ? ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : n; return f ? v.target / f : 0; }} />
        <CalcCard title="Lumpsum growth" note="Future value"
          fields={[{ k: "amount", label: "Amount (₹)", def: 100000 }, { k: "years", label: "Years", def: 10 }, { k: "rate", label: "Return % p.a.", def: 12 }]}
          compute={(v) => v.amount * Math.pow(1 + v.rate / 100, v.years)} />
        <CalcCard title="Loan EMI" note="Monthly EMI"
          fields={[{ k: "loan", label: "Loan (₹)", def: 2500000 }, { k: "years", label: "Years", def: 20 }, { k: "rate", label: "Interest % p.a.", def: 8.5 }]}
          compute={(v) => { const i = v.rate / 1200, n = v.years * 12; return i ? v.loan * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1) : v.loan / n; }} />
        <CalcCard title="Inflation impact" note="Future cost"
          fields={[{ k: "amount", label: "Today's cost (₹)", def: 100000 }, { k: "years", label: "Years", def: 10 }, { k: "rate", label: "Inflation % p.a.", def: 6 }]}
          compute={(v) => v.amount * Math.pow(1 + v.rate / 100, v.years)} />
        <CalcCard title="Retirement corpus" note="Corpus needed (25×)"
          fields={[{ k: "expense", label: "Monthly expense now (₹)", def: 50000 }, { k: "years", label: "Years to retire", def: 25 }, { k: "infl", label: "Inflation % p.a.", def: 6 }]}
          compute={(v) => v.expense * 12 * Math.pow(1 + v.infl / 100, v.years) * 25} />
      </div>
    </>
  );
}

/* ── owner: payment details (UPI) — persists across updates ────────── */
function PaymentSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSettings().then(setS).catch(() => setS({ upi_id: "", payee: "Folio", amount: 99 })); }, []);
  if (!s) return null;
  const save = async () => {
    setBusy(true); setMsg("");
    try { await saveSettings({ upi_id: (s.upi_id || "").trim(), payee: (s.payee || "Folio").trim(), amount: Number(s.amount) || 99, business_amount: Number(s.business_amount) || 6000 }); setMsg("Saved. Payers will now see this UPI."); }
    catch (e) { setMsg(e?.message ? `Couldn't save: ${e.message}` : "Couldn't save. Make sure schema_settings.sql has been run."); }
    finally { setBusy(false); }
  };
  const field = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontFamily: T.sans, fontSize: 13.5, outline: "none" };
  const lbl = { fontSize: 12, color: T.muted, marginBottom: 4, display: "block" };
  return (
    <Panel style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Payment details</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Your UPI ID</label>
          <input style={field} value={s.upi_id || ""} placeholder="yourname@bank" onChange={(e) => setS({ ...s, upi_id: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Payee name</label>
          <input style={field} value={s.payee || ""} placeholder="Folio" onChange={(e) => setS({ ...s, payee: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Basic price (₹/month)</label>
          <input style={field} type="number" value={s.amount ?? 99} onChange={(e) => setS({ ...s, amount: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Business price (₹/month)</label>
          <input style={field} type="number" value={s.business_amount ?? 6000} onChange={(e) => setS({ ...s, business_amount: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} disabled={busy} style={btnGold}><Save size={14} /> {busy ? "Saving…" : "Save"}</button>
        {msg && <span style={{ fontSize: 12.5, color: T.muted }}>{msg}</span>}
      </div>
    </Panel>
  );
}

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

  const setPlan = async (u, plan, paid) => {
    setBusy(u.id + plan);
    try { await setProfilePlanPaid(u.id, plan, paid, 30); await load(); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(""); }
  };
  const planActive = (until) => until && until >= today();

  const cell = (u, plan, active, until) => (
    <td style={{ padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <span style={{ color: active ? T.pos : T.faint, fontSize: 12, fontWeight: 600 }}>{active ? (until ? `till ${until}` : "active") : "—"}</span>
        {active
          ? <button onClick={() => setPlan(u, plan, false)} disabled={busy === u.id + plan} style={{ ...btnGhost, padding: "5px 9px" }}>Off</button>
          : <button onClick={() => setPlan(u, plan, true)} disabled={busy === u.id + plan} style={{ ...btnGold, padding: "5px 9px" }}><Check size={12} /> 30d</button>}
      </div>
    </td>
  );

  return (
    <>
      <PaymentSettings />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          Members <span style={{ color: T.faint, fontWeight: 400 }}>· {users ? users.length : "…"}</span>
        </div>
        <button onClick={load} style={btnGhost}><RefreshCw size={14} /> Refresh</button>
      </div>
      {err && <div style={{ color: T.neg, fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
      <Panel pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ color: T.muted }}>
                <th style={{ padding: "11px 14px", textAlign: "left", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Email</th>
                <th style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Basic ₹99</th>
                <th style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Business ₹6000</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u) => {
                if (u.role === "owner") return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 14px" }}>{u.email}</td>
                    <td colSpan={2} style={{ padding: "10px 14px", textAlign: "right", color: T.gold, fontWeight: 600 }}>Owner — full access</td>
                  </tr>
                );
                const b = planActive(u.basic_until) || (u.is_paid && (!u.paid_until || u.paid_until >= today()));
                const z = planActive(u.business_until);
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 14px" }}>{u.email}</td>
                    {cell(u, "basic", b, u.basic_until || u.paid_until)}
                    {cell(u, "business", z, u.business_until)}
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
        When someone pays, tap <b style={{ color: T.muted }}>30d</b> under the plan they bought (Basic ₹99 or Business ₹6000). Their app unlocks instantly for 30 days. Tap <b style={{ color: T.muted }}>Off</b> to revoke.
      </div>
    </>
  );
}

if (typeof document !== "undefined" && !document.getElementById("spin-kf")) {
  const s = document.createElement("style"); s.id = "spin-kf";
  s.textContent = "@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}";
  document.head.appendChild(s);
}
