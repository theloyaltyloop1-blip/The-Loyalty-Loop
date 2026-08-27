# The Loyalty Loop

A digital loyalty, CRM, and cross-shop discovery platform for independent
high-street businesses. Customers add a branded loyalty pass straight to
Apple Wallet or Google Wallet — no app download required — and merchants
scan that pass at the counter to award stamps or points and redeem rewards.

## Apps

| App | Path | Stack |
| --- | --- | --- |
| Web (customers + business owner dashboard) | `apps/web` | Vite + React, deployed on Vercel |
| Retailer (merchant scanning app) | `apps/retailer` | Expo / React Native |
| Shopper (customer app) | `apps/shopper` | Expo / React Native |
| Admin | `apps/admin` | — |

All three apps share one Supabase backend (`supabase/`) — Postgres database,
Row Level Security policies, Auth, Storage, and Edge Functions.

## Documentation

- [`docs/LOYALTY-LOOP-DATA-MODEL.md`](docs/LOYALTY-LOOP-DATA-MODEL.md) — database schema and RLS design
- [`docs/LOYALTY-LOOP-DESIGN-SYSTEM.md`](docs/LOYALTY-LOOP-DESIGN-SYSTEM.md) — design tokens and UI conventions
- [`docs/LOYALTY-LOOP-FEATURE-LIST.md`](docs/LOYALTY-LOOP-FEATURE-LIST.md) — feature scope
- [`CHANGELOG.md`](CHANGELOG.md) — release history (semantic versioning; current version in [`VERSION`](VERSION))

## Getting started

```bash
npm install
npm run dev:web        # web app, local dev server
npm run build:web      # web app, production build
```

The `apps/retailer` and `apps/shopper` Expo apps are run and built via
`eas-cli` (see each app's own directory for its `eas.json` build profiles).

## Environment variables

Each app needs its own Supabase URL/anon key (and other service keys) set as
environment variables — see `apps/web/.env.example` for the web app's
required variables, and each Expo app's EAS environment configuration
(`eas env:list`) for the mobile apps'.

## Backups

See [`scripts/backup.sh`](scripts/backup.sh) for a script that snapshots the
project's source files (excluding `node_modules`/build output) and dumps the
Supabase database schema. Git/GitHub is the primary backup for source code;
this script exists for local point-in-time snapshots and the database dump
Git doesn't cover.
