import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { T } from "../theme";
import { supabase, configured } from "../supabaseClient";
import { Center, Field, Logo, inputS, btnGold } from "./ui.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!configured) return setErr("App not connected to its database yet. Add the Supabase keys (see setup guide).");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };

  return (
    <Center>
      <div style={{ width: 360, maxWidth: "92vw", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, fontFamily: T.sans }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Logo size={30} />
          <span style={{ color: T.text, fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Folio</span>
        </div>
        <div style={{ color: T.muted, fontSize: 13, marginBottom: 22 }}>Sign in to your portfolio.</div>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="none"
            placeholder="you@example.com" style={inputS} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        <Field label="Password">
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password"
            placeholder="••••••••" style={inputS} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        {err && <div style={{ color: T.neg, fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ ...btnGold, width: "100%", justifyContent: "center", marginTop: 6, opacity: busy ? 0.6 : 1 }}>
          <LogIn size={15} /> {busy ? "Signing in…" : "Sign in"}
        </button>
        <div style={{ color: T.faint, fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
          Accounts are created by the owner. Contact them for access.
        </div>
      </div>
    </Center>
  );
}
