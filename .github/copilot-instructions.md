# Copilot Instructions for actual-fyi

## Project Overview
- **actual-fyi** is a Next.js 15+ app for forensic audits of power station products, with a focus on technical integrity and real-world discharge tests.
- The app uses a multi-stage audit pipeline, with data sourced and verified via Supabase and LLM synthesis.
- UI is React (function components, hooks), styled with Tailwind CSS.

## Key Architecture & Data Flow
- **API routes** (in `app/api/`) handle audit requests, product lookups, and status endpoints. Main entry: `app/api/audit/route.ts`.
- **Audit pipeline**: Multi-stage, progressive audit (see `lib/auditStages.ts`, `lib/auditWorker.ts`, `lib/stageExecutors.ts`). Stages:
  1. Claim Profile (manufacturer specs)
  2. Independent Signal (external reviews)
  3. Forensic Discrepancies (LLM synthesis)
  4. Verdict & Truth Index
- **Supabase** is used for all persistent data (products, audits, shadow_specs). Credentials are required in env vars.
- **UI pages**:
  - `/specs` (ledger, filterable)
  - `/specs/[slug]` (product detail, audit results)
  - `/contribute` (submit new audit)
- **Component pattern**: All UI is in `components/`, with a central `Layout.tsx` and feature-specific components (e.g., `ProductDetailView`, `DiscrepancyCard`).

## Developer Workflows
- **Run locally**: `npm install` → set `GEMINI_API_KEY` in `.env.local` → `npm run dev`
- **Build**: `npm run build` (Next.js)
- **Preview Cloudflare Pages**: `npm run preview`
- **Lint**: `npm run lint`
- **Seed data**: Use `seed.products.ts` or `scripts/backfillCategories.ts` for DB population.

## Project-Specific Conventions
- **API/server code** uses `@/lib/dataBridge.server.ts` for all DB access; client code uses `@/lib/dataBridge.client.ts`.
- **Audit stages** are always run in order; each stage is idempotent and can be retried.
- **TypeScript** is enforced throughout; types are in `types.ts`.
- **Env config**: All secrets (Supabase, Gemini) must be set in `.env.local`.
- **UI state**: Product/audit detail pages hydrate from server, then fallback to client fetch if needed.
- **Edge/serverless**: Some routes run on Vercel Edge, others on Node.js (see `runtime` export in route files).

## Integration Points
- **Supabase**: All persistent data (products, audits, shadow_specs)
- **Gemini API**: Used for LLM synthesis in audit stages (requires `GEMINI_API_KEY`)
- **Cloudflare Pages**: Supported via `pages:build` and `preview` scripts

## Examples & References
- See `lib/auditStages.ts` for audit stage logic and conventions
- See `app/specs/page.tsx` and `app/specs/[slug]/page.tsx` for UI/data hydration patterns
- See `lib/dataBridge.server.ts` for DB access patterns

---

**For AI agents:**
- Always use the provided dataBridge helpers for DB access
- Follow the audit stage order and idempotency
- Reference types from `types.ts` for all data models
- When adding new audit stages or data flows, update both server and client bridges
- Use Tailwind for all new UI components
