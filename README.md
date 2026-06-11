# Folio — Private Portfolio Tracker

Installable web app (PWA) for tracking an Indian equity portfolio. Per-user logins, private data, charts, and an optional AI command bar.

## Stack
- React + Vite (frontend)
- Supabase (auth + Postgres with row-level security)
- Vercel (hosting + serverless functions for the AI proxy and price fetch)

## Quick start
See **SETUP_GUIDE.md** for full step-by-step deployment.

Local dev:
1. `npm install`
2. Copy `.env.example` to `.env` and fill in Supabase keys
3. `npm run dev`

## Structure
- `src/` — React app (App.jsx is the shell + pages; components/ holds UI)
- `api/` — Vercel serverless functions (`ai.js`, `quote.js`)
- `supabase/schema.sql` — database tables + RLS policies
- `public/` — PWA manifest, service worker, icons
