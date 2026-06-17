// Vercel serverless function: /api/admin
// Owner-only. Lists users and activates/deactivates their subscription.
// Uses the Supabase SERVICE ROLE key (server-side only — never exposed to the browser).
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: "Admin not configured" });

  try {
    // 1) Identify the caller from their access token
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not signed in" });
    const { data: u, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !u?.user) return res.status(401).json({ error: "Invalid session" });

    // 2) Only the owner may use this endpoint
    const { data: me } = await admin
      .from("profiles").select("role").eq("id", u.user.id).single();
    if (me?.role !== "owner") return res.status(403).json({ error: "Owner only" });

    const { action, userId, days = 30 } = req.body || {};

    if (action === "list") {
      const { data } = await admin
        .from("profiles")
        .select("id,email,role,is_paid,paid_until,created_at")
        .order("created_at", { ascending: true });
      return res.status(200).json({ users: data || [] });
    }

    if (action === "activate") {
      const until = new Date();
      until.setDate(until.getDate() + Number(days || 30));
      const { data } = await admin
        .from("profiles")
        .update({ is_paid: true, paid_until: until.toISOString().slice(0, 10) })
        .eq("id", userId).select().single();
      return res.status(200).json({ user: data });
    }

    if (action === "deactivate") {
      const { data } = await admin
        .from("profiles")
        .update({ is_paid: false, paid_until: null })
        .eq("id", userId).select().single();
      return res.status(200).json({ user: data });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
