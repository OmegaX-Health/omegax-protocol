# OmegaX Protocol

OmegaX Protocol is a Solana settlement layer for builders creating health apps, oracle services, sponsor programs, and outcome-triggered capital flows.

On Solana devnet beta today, the public surface in this repository can already anchor:

- normalized outcome events produced by OmegaX Health or future compatible oracle operators
- member enrollment, claim intake, obligations, reserve booking, and payouts
- sponsor-funded reward or protection lanes
- LP-facing capital pools, classes, allocations, redemptions, and impairment handling

## Start Here

- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Repository Documentation Map](./docs/README.md)

## Choose Your Path

### Oracle and event producers

Build normalized event pipelines, oracle operators, and verification services that feed OmegaX-compatible outcomes into the protocol.

Start with:

- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)

### Health / wallet / app builders

Use the public SDK and read models to integrate member state, claim intake, payout posture, and outcome-triggered experiences into apps, wallets, or agents.

Start with:

- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.omegax.health/docs/sdk/sdk-workflows)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)

### Sponsor and capital integrators

Connect sponsor budgets, policy series, funding lines, pools, classes, and allocations to one reserve-aware settlement kernel.

Start with:

- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture)
- [Release v0.3.0](./docs/operations/release-v0.3.0.md)

## What Exists Today on Devnet Beta

- reserve domains and domain asset vaults define settlement boundaries and payment rails
- health plans, policy series, and funding lines define sponsor and member-side products
- member enrollment, claim intake, obligations, settlement, and impairment are mounted in the canonical console
- liquidity pools, capital classes, allocations, and redemptions define LP-facing exposure and queue behavior
- oracle registry and schema registry accounts let outside event producers and integrations target the same public surface

## Long-Term Destination

OmegaX Health is the first oracle and the public sponsor/operator console is the first managed experience around the protocol.

The destination is still health capital markets: one shared settlement foundation that can support sponsor programs, coverage products, outside oracle builders, wallet-native health apps, and capital formation without fragmenting the underlying accounting truth.

## Protocol Model

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

## Current Surface Notes

This repository treats the earlier pool-first surface as retired devnet history and improves the current canonical model in place.

- sponsor budgets are not LP capital
- reward and protection reconcile through one reserve kernel
- reserve truth is ledger-based, not implied by scattered treasuries
- restricted or wrapper-mediated participation is layered through reserve domains, capital classes, and managed LP credentialing rather than parallel protocols

## Release Status

Current publish target: `v0.3.0`

This is the first publishable canonical OmegaX health-capital-markets surface.

- it is a hard-break devnet migration from the retired pool-first model
- reserve domains define hard custody and legal settlement boundaries
- health plans define sponsor, member, liability, and claims administration roots
- funding lines separate sponsor budgets, premiums, LP allocations, and backstops
- liquidity pools and capital classes define LP-facing exposure, yield, impairment, and redemption rights
- allocation positions bridge capital sleeves into plan-side liabilities without hiding attribution
- the canonical console now mounts `/plans`, `/capital`, `/claims`, `/members`, `/governance`, `/oracles`, and `/schemas` against live snapshot-backed protocol reads
- `/plans/new` now launches from live reserve-domain, vault-rail, oracle, and schema registry data rather than fixture-only defaults
- `/plans/new?template=genesis-protect-acute` now bootstraps the canonical Genesis Protect Acute shell in place using the frozen Event 7 and Travel 30 launch truth
- `/plans?...&setup=genesis-protect-acute` now exposes the Genesis setup checklist, issuance posture, and reserve-warning view inside the mounted sponsor/operator workspace
- the mounted Genesis claims tab now behaves as an operator claim queue with summary cards, queue filters, selected-case detail, and contextual handoff into adjudication, reserve, and oracle follow-through
- the mounted Genesis treasury tab now behaves as a reserve console with lane filters, per-SKU reserve attribution, degraded-visibility warnings, and treasury actions scoped from the selected live funding lane
- `/governance` now exposes mounted protocol bootstrap actions for governance, reserve domains, and domain asset vaults
- `/members` now leads with self-serve enrollment and `/claims` now leads with self-serve claim intake on the canonical model
- mounted workbenches now include sponsor-side post-launch series and funding-line actions, LP credentialing updates, and claim impairment handling
- the protocol now includes first-class oracle registry and outcome-schema registry accounts with checked-in generated artifacts

Genesis Protect Acute sprint-1 launch truth is frozen in the public metadata and fixture surface for the April 16-20, 2026 implementation window.

- `Travel 30` is the primary launch SKU and `Event 7` is the fast demo SKU
- the current public target is end-of-month mainnet readiness, not broadly live insurance issuance today
- phase-0 claims trust is an operator-backed oracle flow rather than decentralized adjudication
- AI recommendation and more explicit decentralized review remain next-phase work, not current public fact
- prediction markets do not count as reserve truth; only posted premiums, sponsor funds, liquidity, and explicit backstops do
- app membership billing remains separate from per-window protection premiums
- the public sponsor/operator console now carries the Genesis bootstrap, checklist, operator claim queue, and reserve-console read path directly on `/plans`
- the Genesis protection metadata disclosure routes now resolve on the public protocol frontend at `/coverage/technical-terms` and `/coverage/risk-disclosures`

Read the canonical design set first:

- [ADR 0001](./docs/adr/0001-health-capital-markets-rearchitecture.md)
- [WHY_THIS_MODEL](./docs/WHY_THIS_MODEL.md)
- [MIGRATION_MATRIX](./docs/MIGRATION_MATRIX.md)
- [Public Release Gate](./docs/operations/public-release-gate.md)
- [Devnet Beta Runbook](./docs/operations/devnet-beta-runbook.md)
- [Release v0.3.0](./docs/operations/release-v0.3.0.md)

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

## Maintainer and Devnet Operations

These helpers are for repo maintainers and shared-devnet operators rather than first-time SDK consumers.

- `npm run protocol:bootstrap`
  - writes `devnet/health-capital-markets-manifest.json`
  - writes `devnet/health-capital-markets.env`
  - emits stable canonical fixture ids for the new model
- `npm run protocol:bootstrap:devnet-live`
  - seeds the canonical plan/capital/oracle/schema graph onto shared devnet using the configured signer
  - provisions reusable local role wallets under `$HOME/.config/solana/omegax-devnet/`
  - syncs canonical public role addresses back into `frontend/.env.local`
- `npm run devnet:frontend:bootstrap`
  - syncs canonical fixture env values into `frontend/.env.local`
  - writes `frontend/public/devnet-fixtures.json`
- `npm run devnet:beta:deploy`
  - runs the checked build and artifact parity
  - regenerates the canonical bootstrap artifacts
  - leaves the final live deploy step operator-mediated for auditability
  - prints the exact canonical `solana program deploy --program-id ...` upgrade command and warns if `target/deploy/omegax_protocol-keypair.json` has drifted away from the canonical program id
- `npm run devnet:frontend:smoke`
  - checks that the canonical fixture set is present and coherent
- `npm run devnet:frontend:signoff`
  - runs the strict frontend parity matrix against the canonical fixture/env set
- `npm run devnet:governance:smoke:create-vote`
  - creates the shared-devnet governance smoke proposal
- `npm run devnet:governance:smoke:execute`
  - executes the previously created governance smoke proposal after the DAO windows expire
- `npm run devnet:governance:ui:readonly`
  - verifies readonly governance routes against the current devnet proposal state
- `npm run devnet:beta:observe`
  - captures a structured observability snapshot for the shared devnet deployment

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
