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
