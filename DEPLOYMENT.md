# Deployment Guide

## Canonical Runtime: Vercel

**Production URL**: `https://actual-fyi.vercel.app`

Actual.fyi is deployed exclusively on Vercel. Cloudflare Pages deployment has been deprecated.

---

## Environment Variables

Required for **Production** environment in Vercel Dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
GOOGLE_AI_STUDIO_KEY=AIza...
```

---

## Build Configuration

- **Framework**: Next.js (auto-detected)
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (auto-detected)
- **Node Version**: 18.x or 20.x

---

## Deployment Workflow

1. Push to `main` branch
2. Vercel auto-deploys to production
3. Preview deployments for all PRs

---

## Metadata Configuration

Canonical base URL is set via `metadataBase` in `app/layout.tsx`:
- Uses `VERCEL_URL` environment variable (auto-set by Vercel)
- Fallback: `https://actual-fyi.vercel.app`

All OpenGraph URLs and canonical tags resolve to Vercel deployment URL.

---

## Deprecated

⚠️ **Cloudflare Pages** - No longer in use. Configuration archived in `_archive/`.
