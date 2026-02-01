# Audit Pipeline V1 - Deployment Guide

## 1. Environment Variables
Ensure these are set in **Cloudflare Pages > Settings > Environment Variables** (Production & Preview):

| Variable | Description |
| :--- | :--- |
| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase Project URL (`https://...supabase.co`) - Server Only |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** Service Role Key - Server Only |
| `GOOGLE_AI_STUDIO_KEY` | Gemini API Key - Server Only |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` but for Client (Browser) |
| `VITE_SUPABASE_ANON_KEY` | Public Anon Key - Client (Browser) |

> **⚠️ CAUTION:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Use carefully. Ensure `dataBridge.ts` is not imported by client-side code (it shouldn't be, checked by build).

## 2. Supabase Schema
Ensure `shadow_specs` table exists with:
- `product_id` (foreign key)
- `claimed_specs` (jsonb)
- `actual_specs` (jsonb)
- `red_flags` (jsonb)
- `truth_score` (numeric)

## 3. Smoke Testing
Locally:
```bash
npm run dev
# In another terminal:
node scripts/smoke-audit.mjs ecoflow-delta-2
```

Expected Output:
```json
{
  "ok": true,
  "audit": { ... },
  "cached": true/false
}
```

## 4. Debugging Not-Found Errors
If you get `ASSET_NOT_FOUND`:
1.  Check `products` table in Supabase.
2.  Ensure `slug` column exactly matches the input (case-sensitive?).
3.  The pipeline **DOES NOT** scrape or invent products. It *only* audits what is in the DB.

## 5. Deployment
```bash
npm run build
npx wrangler pages deploy dist
```
