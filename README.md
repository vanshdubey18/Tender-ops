# TenderOps

**AI agent that monitors government e-tender portals (GeM) for any business, scores relevant tenders against that business's profile, and alerts the team before deadlines are missed.**

Built for the IIT Jammu AI First Hackathon 2026 — Round 2 (Prototype Development & MVP) by team **404 Not Found**.

Live demo: https://tenderops-gazette-dubehvansh22-2337s-projects.vercel.app

---

## The problem

Small and mid-sized suppliers of every kind — medical equipment, construction materials, IT hardware, office supplies, whatever they sell — win business through GeM (Government e-Marketplace) tenders. New tenders are published constantly, buried across categories, and easy to miss — a missed deadline is lost revenue. Manually checking the portal every day doesn't scale, no matter what sector you're in.

## What TenderOps does

TenderOps is sector-agnostic — it works for any business that bids on GeM tenders. A business sets up its profile once (what it sells, its categories, its location), and TenderOps takes it from there:

- **Scans** GeM for new tenders matching that business's product categories and location.
- **Scores** each tender for relevance against the business's profile, so the team sees the ones worth bidding on first, not a raw firehose of listings.
- **Case files** — every scored tender gets a short written rationale explaining *why* it matched, so a non-technical reviewer can trust the score.
- **Alerts** the team on Telegram the moment a strong match is found, with the tender details and a direct link back into the app.
- **Bid Expert** *(MVP placeholder)* — a per-tender assistant panel where the team can eventually get help drafting bid paperwork; wired into the UI and alert links now, backend AI drafting is the next milestone.

The live demo is seeded with a medical equipment distributor as one illustrative example — the underlying scan, scoring, and alert pipeline has no medical-specific logic and works the same way for any product category or industry.

## How it works

1. A business profile is set up once during onboarding (sector, product categories, location) — any sector.
2. A scan (scheduled via cron, or triggered on demand from the dashboard) pulls current GeM tender listings.
3. Each tender is scored against the business profile using an LLM reasoning pass, producing a relevance score and a short "case file" explaining the reasoning.
4. High-relevance matches are pushed to the team's Telegram, and surfaced in the dashboard's Case Files tab.
5. From either the alert or the dashboard, the team can jump into Bid Expert for that specific tender.

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Supabase** — business profiles, tender records, scan history
- **Anthropic API** (`@anthropic-ai/sdk`) — tender relevance scoring and case-file reasoning
- **Telegram Bot API** — real-time alerts
- **Vercel** — hosting and deployment, including scheduled cron for periodic scans

## Project structure

```
app/
  page.tsx                 landing page
  login/page.tsx           auth
  onboarding/page.tsx      business profile setup
  dashboard/page.tsx       main app — overview, knowledge base, case files, scan trigger
  bid-expert/page.tsx      per-tender bid assistant (MVP placeholder UI)
  api/
    scan/mock/route.ts     demo scan endpoint (seeded data, drives the live demo)
    cron/run/route.ts      scheduled production scan pipeline
    telegram/confirm/route.ts
  lib/
    supabaseClient.ts
    supabaseAdmin.ts
  globals.css
```

## Running locally

```bash
npm install
npm run build
npm run start
```

Requires environment variables for Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), the Anthropic API (`ANTHROPIC_API_KEY`), and Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) — configured as project secrets in Vercel for the deployed instance.

## Current state / what's next

This is an MVP built in the hackathon window. The demo flow (`api/scan/mock`) uses seeded sample tenders so the scoring, case-file, and alert pipeline can be demonstrated reliably end-to-end; the real GeM scraping pipeline (`api/cron/run`) is built and scheduled but depends on live portal access. Bid Expert is UI-only in this build — the next milestone is wiring it to read a tender's bid documents alongside the business's own knowledge base and help draft the actual bid paperwork.

## Team

404 Not Found — AI First Hackathon 2026, I3C IIT Jammu × Techible
