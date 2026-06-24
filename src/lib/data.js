import { supabase } from "../supabaseClient";

export async function fetchHoldings(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("holdings").select("*").eq("client_id", clientId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// All holdings across every client of an advisor (for the advisor dashboard).
export async function fetchAllHoldings(advisorId) {
  const { data, error } = await supabase
    .from("holdings").select("*").eq("user_id", advisorId);
  if (error) throw error;
  return data || [];
}

export async function addHolding(userId, clientId, h) {
  const { data, error } = await supabase.from("holdings")
    .insert({ ...h, user_id: userId, client_id: clientId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateHolding(id, fields) {
  const { data, error } = await supabase.from("holdings")
    .update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHolding(id) {
  const { error } = await supabase.from("holdings").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSnapshots(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("snapshots").select("*").eq("client_id", clientId).order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveSnapshot(userId, clientId, date, value) {
  const { data, error } = await supabase.from("snapshots")
    .upsert({ user_id: userId, client_id: clientId, date, value }, { onConflict: "user_id,date" }).select().single();
  if (error) throw error;
  return data;
}

/* ── profiles & subscription (paywall) ────────────────────────────── */
export async function fetchMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

// Owner manages members directly; secured by the owner-only RLS policy.
export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,is_paid,paid_until,basic_until,business_until,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function setProfilePaid(userId, paid, days = 30) {
  let paid_until = null;
  if (paid) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    paid_until = d.toISOString().slice(0, 10);
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_paid: paid, paid_until })
    .eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

// Activate / deactivate a specific plan for a member (owner only, via RLS).
export async function setProfilePlanPaid(userId, plan, paid, days = 30) {
  let until = null;
  if (paid) { const d = new Date(); d.setDate(d.getDate() + days); until = d.toISOString().slice(0, 10); }
  const col = plan === "business" ? "business_until" : "basic_until";
  const patch = { [col]: until };
  if (plan === "basic") { patch.is_paid = paid; patch.paid_until = until; } // keep legacy field in sync
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

/* ── invested-journey (from tradebook) ────────────────────────────── */
export async function fetchJourney(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("journey").select("date,invested").eq("client_id", clientId).order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveJourney(userId, clientId, series) {
  await supabase.from("journey").delete().eq("client_id", clientId);
  if (!series.length) return [];
  const rows = series.map((p) => ({ user_id: userId, client_id: clientId, date: p.date, invested: p.invested }));
  const { data, error } = await supabase.from("journey").insert(rows).select("date,invested");
  if (error) throw error;
  return data || [];
}

/* ── app settings (payment / UPI) ─────────────────────────────────── */
export async function getSettings() {
  const { data, error } = await supabase
    .from("app_settings").select("upi_id,payee,amount,business_amount").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function saveSettings(s) {
  const { data, error } = await supabase.from("app_settings")
    .upsert({ id: 1, upi_id: s.upi_id, payee: s.payee, amount: s.amount, business_amount: s.business_amount, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("upi_id,payee,amount,business_amount").single();
  if (error) throw error;
  return data;
}

/* ── clients (advisor's book) ─────────────────────────────────────── */
export async function fetchClients(advisorId) {
  const { data, error } = await supabase
    .from("clients").select("*").eq("advisor_id", advisorId).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function addClient(advisorId, c) {
  const { data, error } = await supabase.from("clients")
    .insert({ ...c, advisor_id: advisorId }).select().single();
  if (error) throw error;
  return data;
}
export async function updateClient(id, fields) {
  const { data, error } = await supabase.from("clients").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

/* ── CRM: notes ───────────────────────────────────────────────────── */
export async function fetchNotes(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function addNote(advisorId, clientId, body) {
  const { data, error } = await supabase.from("client_notes")
    .insert({ advisor_id: advisorId, client_id: clientId, body }).select().single();
  if (error) throw error;
  return data;
}
export async function deleteNote(id) {
  const { error } = await supabase.from("client_notes").delete().eq("id", id);
  if (error) throw error;
}

/* ── CRM: tasks / reminders ───────────────────────────────────────── */
export async function fetchTasks(advisorId) {
  const { data, error } = await supabase
    .from("client_tasks").select("*").eq("advisor_id", advisorId).order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}
export async function addTask(advisorId, clientId, title, due_date) {
  const { data, error } = await supabase.from("client_tasks")
    .insert({ advisor_id: advisorId, client_id: clientId || null, title, due_date: due_date || null }).select().single();
  if (error) throw error;
  return data;
}
export async function toggleTask(id, done) {
  const { data, error } = await supabase.from("client_tasks").update({ done }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteTask(id) {
  const { error } = await supabase.from("client_tasks").delete().eq("id", id);
  if (error) throw error;
}
