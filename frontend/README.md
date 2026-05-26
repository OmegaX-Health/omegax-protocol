# Frontend

This directory contains the Next.js protocol console for the canonical OmegaX health-capital-markets model.

## Responsibilities

- render the public protocol console
- expose sponsor, member, capital, governance, oracle, and schema views against the canonical nouns
- keep route language aligned with `HealthPlan`, `PolicySeries`, `FundingLine`, `LiquidityPool`, and `CapitalClass`
- provide source and legal links for hosted AGPL deployments
- keep client-visible configuration separated from runtime-only secrets
- keep the mounted canonical routes backed by live protocol snapshot reads rather than fixture-only previews
- keep `/oracles` focused on registry/readiness operations while dedicated profile-authoring flows live at `/oracles/register` and `/oracles/[oracleAddress]/update`

## Key directories

- `app/` contains routes, layouts, and API handlers
- `lib/protocol.ts` contains PDA helpers, transaction builders, reserve math, and deterministic read models
- `lib/use-protocol-console-snapshot.ts` is the live snapshot adapter used by the mounted canonical routes
- `lib/devnet-fixtures.ts` contains stable canonical fixture ids used for tests, docs, and devnet bootstrap output
- `lib/console-model.ts` builds the sponsor/member/capital views used by the console
- `public/` contains static assets intended for redistribution

## Design references

- Keep the frontend aligned with the repository-level [`../DESIGN.md`](../DESIGN.md) rather than generic SaaS admin patterns.
- `../DESIGN.md` is the source of truth for the protocol console palette, route responsibilities, state-boundary copy, responsive rules, accessibility rules, and anti-slop bans.
- The separate `omegax-design` skill is for the consumer health-agent app, not this protocol frontend. Do not import health-agent-only visual rules into the protocol console unless a protocol-specific design decision explicitly adopts them.

## Commands

```bash
npm --prefix frontend ci
npm --prefix frontend run dev
npm --prefix frontend run build
```

Release support from the repository root:

```bash
npm run devnet:frontend:bootstrap
npm run devnet:frontend:signoff
```

## Environment

Start from:
- `frontend/.env.example`
- `frontend/apphosting.yaml`

Rules:
- `NEXT_PUBLIC_*` values are treated as public runtime configuration
- repo-root `firebase.json` wires App Hosting deploys for this frontend
- `.firebaserc` must stay local and untracked in this public repo
- if runtime-only hosting values are added later, use Secret Manager references in `frontend/apphosting.yaml`
- governance screens are sensitive to RPC rate limits; configure dedicated per-network browser-safe, origin-restricted Helius RPC URLs with `NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL_WITH_KEY` and `NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL_WITH_KEY` for steadier proposal reads
- configured Helius endpoints become the default browser RPC profile; do not copy server-side protocol-oracle RPC secrets into `NEXT_PUBLIC_*` values
- `NEXT_PUBLIC_SOURCE_REPO_URL` should point at the exact public source repository or release used by the hosted deployment
- `npm run devnet:frontend:bootstrap` and `npm run devnet:frontend:signoff` load `frontend/.env.local` before resolving fixture state
- mounted canonical workbenches should prefer the live snapshot adapter; fixtures should remain a bootstrap/test/docs input rather than the primary operator data source
- prefer the canonical `NEXT_PUBLIC_DEVNET_*_WALLET` and payment-rail mint names from `frontend/.env.example`; `lib/devnet-fixtures.ts` still accepts the older pool-first wallet and rail aliases for local compatibility until `.env.local` is refreshed

## Operations

### Health endpoint

`GET /api/health` returns `{ ok: true, version, commit, network, timestamp }` for uptime monitors and post-deploy canary checks. No secrets, no auth. `commit` resolves from `NEXT_PUBLIC_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, or `GIT_COMMIT_SHA` (whichever the deployment platform sets); `network` resolves from `NEXT_PUBLIC_SOLANA_NETWORK` / `NEXT_PUBLIC_REALMS_CLUSTER`.

### Error reporting

`lib/error-tracking.ts` exposes a single `reportError(error, context)` seam used by `app/error.tsx` and `app/global-error.tsx`. Today it logs to console only — no provider is wired in yet. Pre-mainnet, the launch-ops team should pick a provider (Sentry, Highlight, Datadog RUM, or equivalent) and forward from the `TODO(launch-ops)` block. Touching that one file flips every error boundary at once; no boundary call sites need to change.

### SLO posture

Pre-mainnet target: define an availability and time-to-first-snapshot SLO before launch. Track from the `/api/health` endpoint plus error-tracking provider telemetry once that decision lands.

## Deployment boundary

This repo contains the public frontend source and checked-in App Hosting deployment wiring, but not local Firebase project aliases or deployment-only overrides.
