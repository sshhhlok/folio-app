import { supabase } from "../supabaseClient";
import { TEMPLATE } from "../theme";

export async function fetchHoldings(userId) {
  const { data, error } = await supabase
    .from("holdings").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function seedTemplateIfEmpty(userId) {
  const existing = await fetchHoldings(userId);
  if (existing.length) return existing;
  const rows = TEMPLATE.map((t) => ({ ...t, user_id: userId }));
  const { data, error } = await supabase.from("holdings").insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function addHolding(userId, h) {
  const { data, error } = await supabase.from("holdings")
    .insert({ ...h, user_id: userId }).select().single();
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

export async function fetchSnapshots(userId) {
  const { data, error } = await supabase
    .from("snapshots").select("*").eq("user_id", userId).order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveSnapshot(userId, date, value) {
  const { data, error } = await supabase.from("snapshots")
    .upsert({ user_id: userId, date, value }, { onConflict: "user_id,date" }).select().single();
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
    .select("id,email,role,is_paid,paid_until,created_at")
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
