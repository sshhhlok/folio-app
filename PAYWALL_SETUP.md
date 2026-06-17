# Folio — Paywall Upgrade Setup

This adds: sign-up, a ₹99/month paywall for new users, and an **Admin** page where you (the owner) activate people after they pay you. No payment gateway needed — perfect for friends & family.

Do these 5 steps once, on a computer.

---

## Step 1 — Update the code on GitHub
1. Unzip the new `folio-app.zip`.
2. Go to your **folio-app** repo on GitHub → **Add file → Upload files**.
3. Drag in **everything** from the unzipped folder (it will overwrite the changed files). Commit.
   - New files added this time: `api/admin.js`, `supabase/schema_paywall.sql`.

Vercel will auto-redeploy in ~1 minute.

---

## Step 2 — Add the paywall tables (Supabase)
1. Supabase → **SQL Editor → New query**.
2. Open `supabase/schema_paywall.sql`, copy it all, paste, and **before running**, edit the LAST line — replace `YOUR_EMAIL_HERE` with the email you log in with:
   ```
   update profiles set role = 'owner', is_paid = true where email = 'you@example.com';
   ```
3. Click **Run**. This makes you the free owner/admin and sets up the member table.

---

## Step 3 — Turn ON sign-ups (Supabase)
So friends can create their own account:
1. Supabase → **Authentication → Sign In / Providers**.
2. Turn **ON** "Allow new users to sign up".
3. Find **Email** settings and turn **OFF** "Confirm email" (so new sign-ups work instantly without an email link).

---

## Step 4 — Add the admin keys (Vercel)
The Admin page needs a powerful server key. Vercel → your project → **Settings → Environment Variables** → add **two**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the same Project URL you used before |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase **secret key** (`sb_secret_…`) |

⚠️ The **secret key** is the master key — it goes ONLY here in Vercel, never in the app or shared with anyone. Get it from Supabase → **Project Settings → API Keys → secret**.

Then **Redeploy** (Deployments → ⋯ → Redeploy).

---

## Step 5 — (Optional) set your UPI
So the paywall shows people where to pay you:
- In `src/theme.js`, edit the `PAYWALL` block — change `upi: "your-upi@bank"` to your real UPI ID. Re-upload that one file to GitHub.

---

## How it works now
- **You** log in → full app + an **Admin** tab.
- **A friend** taps your link → **Create account** → signs up → sees the **₹99/month paywall**.
- They **pay you ₹99 over UPI**.
- You open **Admin → Activate 30d** next to their email. Their app unlocks instantly for 30 days.
- After 30 days, activate again when they pay again.

That's your first revenue, with zero gateway or paperwork. When you outgrow manual activation, we'll add automatic Razorpay autopay.
