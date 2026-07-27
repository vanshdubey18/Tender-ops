# TenderOps

**AI agent that monitors government e-tender portals for any business, scores relevant tenders against that business's profile, and alerts the team on Telegram the moment a match is found — running on its own schedule, so nobody has to check the portal or the app every day.**

Built for the IIT Jammu AI First Hackathon 2026 — Round 2 (Prototype Development & MVP) by team **404 Not Found**.

Live demo: https://tenderops-gazette-dubehvansh22-2337s-projects.vercel.app

---

## The problem

Small and mid-sized suppliers of every kind — medical equipment, construction materials, IT hardware, office supplies, whatever they sell — win business through government e-tender portals like GeM (Government e-Marketplace) and various state and departmental e-procurement portals. New tenders are published constantly across multiple portals, buried across categories, and easy to miss — a missed deadline is lost revenue. Someone would otherwise have to log in and check every portal every single day just in case, which doesn't scale, no matter what sector you're in.

## What TenderOps does

TenderOps is sector-agnostic and portal-agnostic — it works for any business bidding on government tenders, not just on GeM. A business sets up its profile once (what it sells, its categories, its location), and TenderOps takes it from there:

- **Scans** government e-tender portals — GeM and other major tender portals — for new tenders matching that business's product categories and location.
- **Scores** each tender for relevance against the business's profile, so the team sees the ones worth bidding on first, not a raw firehose of listings.
- **Case files** — every scored tender gets a short written rationale explaining *why* it matched, so a non-technical reviewer can trust the score.
- **Runs on a schedule** — a scan fires automatically at a set time, without anyone needing to open the app or visit the portal.
- **Alerts** the team on Telegram the moment a strong match is found, with the tender details and a direct link back into the app — the tender shows up on its own, nobody has to go looking for it.
- **Bid Expert** *(MVP placeholder)* — a per-tender assistant panel where the team can eventually get help drafting bid paperwork; wired into the UI and alert links now, backend AI drafting is the next milestone.

The live demo is seeded with a medical equipment distributor as one illustrative example, scanning GeM as the first integrated portal — the underlying scan, scoring, and alert pipeline has no medical-specific or portal-specific logic and is built to extend to other major tender portals and any product category or industry.

## How it works

1. A business profile is set up once during onboarding (sector, product categories, location) — any sector.
2. A scan runs automatically on a schedule (via a Vercel cron job) at a set time each day, without anyone needing to trigger it manually — it can also be triggered on demand from the dashboard. It pulls current tender listings from GeM, with the pipeline built to extend to other major government e-tender portals.
3. Each tender is scored against the business profile using an LLM reasoning pass, producing a relevance score and a short "case file" explaining the reasoning.
4. High-relevance matches are pushed straight to the team's Telegram as soon as the scheduled scan finds them, and surfaced in the dashboard's Case Files tab — the team finds out passively, without needing to check in.
5. From either the alert or the dashboard, the team can jump into Bid Expert for that specific tender.

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Apify** — runs hosted actors for portal discovery, currently integrated with GeM and built to extend to other major government e-tender portals for surfacing live tender listings
- **Custom scraping pipeline** — built on top of Apify's discovery layer: downloads each tender's bid document directly and runs it through an LLM extraction pass to pull structured fields (bid number, deadlines, EMD, location, etc.), adding a depth of structured data raw portal listings alone don't provide
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
    cron/run/route.ts      scheduled production scan pipeline (calls the Apify GeM scraper)
    telegram/confirm/route.ts
  lib/
    supabaseClient.ts
    supabaseAdmin.ts
  globals.css
```

## Deployment

TenderOps is live and running on Vercel — see the link at the top of this document. That's the version to use; nothing needs to be run locally to try it.

For development purposes, the project can also be run locally:

```bash
npm install
npm run build
npm run start
```

This requires environment variables for Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), the Anthropic API (`ANTHROPIC_API_KEY`), and Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) — already configured as project secrets on the live Vercel deployment.

## Current state / what's next

This is an MVP built in the hackathon window. The demo flow (`api/scan/mock`) uses seeded sample tenders so the scoring, case-file, and alert pipeline can be demonstrated reliably end-to-end; the real scraping pipeline (`api/cron/run`) is built and scheduled against GeM and depends on live portal access. Extending the scraper to additional major tender portals is a natural next step — the scoring, case-file, and alert logic downstream is already portal-agnostic. Bid Expert is UI-only in this build — the next milestone is wiring it to read a tender's bid documents alongside the business's own knowledge base and help draft the actual bid paperwork.

## Team

404 Not Found — AI First Hackathon 2026, I3C IIT Jammu × Techible
