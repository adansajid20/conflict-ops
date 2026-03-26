# CONFLICT OPS
Geopolitical intelligence platform. See docs/MASTER_PROMPT.md for full spec.

**Status:** Phase 2 rebuild in progress

## Quick Start
```bash
npm install
cp .env.example .env.local
# Fill in env vars, then:
npm run dev
```

## Scheduled ingest
- Vercel cron is configured in `apps/web/vercel.json` for `/api/cron/ingest` every 15 minutes.
- GitHub Actions fallback is configured in `.github/workflows/ingest-cron.yml`.
- Add `INTERNAL_SECRET` to GitHub repo secrets.
- Current value expected by production: `codev1_3dc26d7b4fb024484b5d8a6d3a4887f0`
- Also set `CRON_SECRET` in Vercel for authenticated cron calls.
