# OmegaX Protocol

OmegaX Protocol is the shared Solana settlement foundation for health capital markets.

It separates:

- sponsor/member policy rights
- plan-side funding sources
- LP-facing capital rights
- reserve truth and settlement consequences

The canonical public model in this repository is:

- `ReserveDomain`: hard custody or legal segregation boundary
- `DomainAssetVault`: token custody per `[reserve_domain, asset_mint]`
- `HealthPlan`: sponsor/member/liability root
- `PolicySeries`: versioned product lane
- `FundingLine`: plan-side funding source
- `ClaimCase`: explicit adjudication lifecycle for material claims
- `Obligation`: canonical liability unit
- `LiquidityPool`: LP-facing capital sleeve
- `CapitalClass`: investor instrument inside a pool
- `AllocationPosition`: explicit capital-to-plan bridge

## What Changed

This repository now treats the earlier pool-first surface as retired devnet history.

- the overloaded pre-rearchitecture root is gone
- sponsor budgets are not LP capital
- reward and protection reconcile through one reserve kernel
- reserve truth is ledger-based, not implied by scattered treasuries
- restricted or wrapper-mediated participation is layered through reserve domains, capital classes, and managed LP credentialing, not fake parallel protocols

## Release Status

Current publish target: `v0.3.0`

This is the first publishable canonical OmegaX health-capital-markets surface.

- it is a hard-break devnet migration from the retired pool-first model
- reserve domains define hard custody and legal settlement boundaries
- health plans define sponsor, member, liability, and claims administration roots
- funding lines separate sponsor budgets, premiums, LP allocations, and backstops
- liquidity pools and capital classes define LP-facing exposure, yield, impairment, and redemption rights
- allocation positions bridge capital sleeves into plan-side liabilities without hiding attribution

Read the canonical design set first:

- [ADR 0001](./docs/adr/0001-health-capital-markets-rearchitecture.md)
- [WHY_THIS_MODEL](./docs/WHY_THIS_MODEL.md)
- [MIGRATION_MATRIX](./docs/MIGRATION_MATRIX.md)

## Repository Layout

- [`programs/omegax_protocol/`](./programs/omegax_protocol/) contains the onchain Anchor program
- [`frontend/`](./frontend/) contains the public protocol console and deterministic read models
- [`tests/`](./tests/) contains the fast Node-based scenario suite
- [`e2e/`](./e2e/) contains the heavier localnet audit entrypoint
- [`scripts/`](./scripts/) contains artifact generation and devnet migration helpers
- [`idl/`](./idl/), [`shared/`](./shared/), and [`android-native/protocol/`](./android-native/protocol/) contain checked-in generated contract artifacts

## Quick Start

Install dependencies:

```bash
npm ci
npm --prefix frontend ci
```

Regenerate the canonical onchain artifacts:

```bash
npm run anchor:idl
npm run protocol:contract
```

Run the fast scenario suite:

```bash
npm run test:node
```

Build the public console:

```bash
npm run frontend:build
```

Run the public verification gate:

```bash
npm run verify:public
```

## Devnet Migration Helpers

This redesign is a hard-break devnet migration. The repo now ships manifest-driven helpers rather than legacy bootstrap flows.

- `npm run protocol:bootstrap`
  - writes `devnet/health-capital-markets-manifest.json`
  - writes `devnet/health-capital-markets.env`
  - emits stable canonical fixture ids for the new model
- `npm run devnet:frontend:bootstrap`
  - syncs canonical fixture env values into `frontend/.env.local`
  - writes `frontend/public/devnet-fixtures.json`
- `npm run devnet:beta:deploy`
  - runs the checked build and artifact parity
  - regenerates the canonical bootstrap artifacts
  - leaves the final live deploy step operator-mediated for auditability
- `npm run devnet:frontend:smoke`
  - checks that the canonical fixture set is present and coherent

## Verification Philosophy

The fast suite now focuses on the scenarios that matter to the redesign:

- sponsor-only reward plan without LP capital
- LP-funded protection flows with reserve-aware redemption math
- one pool funding multiple series
- multiple pools co-funding one series
- reward plus protection under one plan root
- restricted capital-class semantics
- separate reserve-domain ring-fencing
- impairment and queue pressure
- scoped pause behavior
- migration smoke for legacy surface retirement

## Documentation Map

- [Solana Program Architecture](./docs/architecture/solana-program-architecture.md)
- [Solana Instruction Map](./docs/architecture/solana-instruction-map.md)
- [Repository Layout](./docs/architecture/repository-layout.md)
- [Frontend Information Architecture](./docs/architecture/frontend-information-architecture.md)
- [tests/README.md](./tests/README.md)

## Public-Safe Boundary

This repository is public-safe by design.

Do not commit:

- private backend services
- private endpoints
- secrets or local validator state
- operator credentials
- machine-specific output

Keep deployment-only control-plane automation outside this repository.
