import React, { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { T } from "../theme";
import { supabase, configured } from "../supabaseClient";
import { Center, Field, Logo, inputS, btnGold } from "./ui.jsx";

export default function Login() {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async () => {
    setErr(""); setMsg("");
    if (!configured) return setErr("App not connected to its database yet. Add the Supabase keys (see setup guide).");
    if (!email.trim() || pw.length < 6) return setErr("Enter an email and a password of at least 6 characters.");
    setBusy(true);
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
      if (error) setErr(error.message);
      else if (!data.session) setMsg("Account created. Please sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) setErr(error.message);
    }
    setBusy(false);
  };

  return (
    <Center>
      <div style={{ width: 360, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, fontFamily: T.sans }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Logo size={30} />
          <span style={{ color: T.text, fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Folio</span>
        </div>
        <div style={{ color: T.muted, fontSize: 13, marginBottom: 22 }}>
          {signup ? "Create your account." : "Sign in to your portfolio."}
        </div>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="none"
            placeholder="you@example.com" style={inputS} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        <Field label="Password">
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
            placeholder="••••••••" style={inputS} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        {err && <div style={{ color: T.neg, fontSize: 12, marginBottom: 10 }}>{err}</div>}
        {msg && <div style={{ color: T.pos, fontSize: 12, marginBottom: 10 }}>{msg}</div>}
        <button onClick={submit} disabled={busy} style={{ ...btnGold, width: "100%", justifyContent: "center", marginTop: 6, opacity: busy ? 0.6 : 1 }}>
          {signup ? <UserPlus size={15} /> : <LogIn size={15} />}
          {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
        <div style={{ color: T.muted, fontSize: 12.5, marginTop: 16, textAlign: "center" }}>
          {signup ? "Already have an account? " : "New here? "}
          <span onClick={() => { setMode(signup ? "signin" : "signup"); setErr(""); setMsg(""); }}
            style={{ color: T.gold, cursor: "pointer", fontWeight: 600 }}>
            {signup ? "Sign in" : "Create one"}
          </span>
        </div>
        {signup && (
          <div style={{ color: T.faint, fontSize: 11, marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
            New accounts get access after a ₹99/month subscription is activated.
          </div>
        )}
      </div>
    </Center>
  );
}
