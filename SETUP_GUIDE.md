# Folio — Setup Guide

This gets your app live on the internet at its own link, then onto your phone's home screen like a normal app. **Do this part on a computer** (~30–45 min, one time). After it's live, you and your friends just use the link on your phones.

Everything below uses free accounts. You'll create three: **GitHub** (stores the code), **Supabase** (logins + database), **Vercel** (puts it online).

---

## Part 1 — Put the code on GitHub

1. Unzip `folio-app.zip` on your computer.
2. Go to **github.com** → sign up (free).
3. Click **New** (green button) → name it `folio-app` → keep **Public** or **Private** (either works) → **Create repository**.
4. On the new repo page, click **uploading an existing file**.
5. Open the unzipped `folio-app` folder, select **everything inside it**, and drag it into the browser. Wait for it to finish, then **Commit changes**.

> Don't upload the `node_modules` folder if you see one — it's huge and not needed.

---

## Part 2 — Set up Supabase (logins + data)

1. Go to **supabase.com** → sign up → **New project**. Pick any name, set a database password (save it), choose a region near India (e.g. Mumbai/Singapore) → **Create**. Wait ~2 min.
2. Left menu → **SQL Editor** → **New query**. Open the file `supabase/schema.sql` from the code, copy all of it, paste, click **Run**. You should see "Success".
3. Left menu → **Authentication** → **Sign In / Providers** (or **Settings**). Turn **OFF** "Allow new users to sign up" — only you create accounts.
4. Get your keys: left menu → **Project Settings** → **API**. Copy two things:
   - **Project URL**
   - **anon public** key

Keep these two handy for Part 3.

---

## Part 3 — Put it online with Vercel

1. Go to **vercel.com** → **Sign up with GitHub** → allow access.
2. Click **Add New → Project** → find `folio-app` → **Import**.
3. Before deploying, open **Environment Variables** and add these:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |
4. Click **Deploy**. After ~1 min you get a live link like `https://folio-app-xxxx.vercel.app`. That's your app.

---

## Part 4 — Create logins for yourself and friends

1. In Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter their **email** and a **password**, and tick **Auto Confirm User**.
3. Send that person the **Vercel link + their email + password**. Done — they're in, with their own private portfolio.

Repeat for each friend. To remove someone, delete their user here.

---

## Part 5 — Put it on your phone

1. Open the Vercel link in your phone browser.
2. **iPhone (Safari):** Share button → **Add to Home Screen**.
   **Android (Chrome):** menu (⋮) → **Add to Home screen / Install app**.
3. It now opens from its own icon, full-screen — no browser, no Claude.

---

## Optional add-ons

**AI prompt bar** — to enable the "type a command" box:
- Get an Anthropic API key from **console.anthropic.com**.
- In Vercel → your project → **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` = your key → **Redeploy**.
- This costs a few paise per command, billed to your Anthropic account. The app works fine without it.

**Live prices** — the **Refresh prices** button pulls best-effort quotes from a free public source. It can be unreliable or miss some symbols; when that happens, edit the LTP manually. Rock-solid live data needs a paid feed (e.g. Zerodha Kite, ~₹500/mo) — we can wire that in later.

---

## If something breaks

- **"App not connected to its database"** on the login screen → the two Supabase variables in Vercel are missing or misspelled. Fix them and redeploy.
- **Can't log in** → make sure you ticked **Auto Confirm User** when creating the account.
- **Changed code on GitHub** → Vercel redeploys automatically within a minute.

That's everything. When you're ready, tell me which part you're on and I'll walk you through it live.
