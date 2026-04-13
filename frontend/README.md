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

- Keep the frontend aligned with the OmegaX design system rather than generic SaaS admin patterns.
- For AI-assisted editing in Codex, load the `omegax-design` skill first.
- Follow the shared design tokens and the protocol frontend surface guidance in the OmegaX design system before large UI changes or route rewrites.

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
- governance screens are sensitive to RPC rate limits; prefer dedicated per-network browser-safe RPC URLs over the shared public Solana endpoints when you need steadier proposal reads
- `NEXT_PUBLIC_SOURCE_REPO_URL` should point at the exact public source repository or release used by the hosted deployment
- `npm run devnet:frontend:bootstrap` and `npm run devnet:frontend:signoff` load `frontend/.env.local` before resolving fixture state
- mounted canonical workbenches should prefer the live snapshot adapter; fixtures should remain a bootstrap/test/docs input rather than the primary operator data source
- prefer the canonical `NEXT_PUBLIC_DEVNET_*_WALLET` and payment-rail mint names from `frontend/.env.example`; `lib/devnet-fixtures.ts` still accepts the older pool-first wallet and rail aliases for local compatibility until `.env.local` is refreshed

## Deployment boundary

This repo contains the public frontend source and checked-in App Hosting deployment wiring, but not local Firebase project aliases or deployment-only overrides.
