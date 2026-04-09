# Release `v0.3.0`

`v0.3.0` is the first publishable canonical OmegaX health-capital-markets release.

## Release meaning

This release retires the earlier pool-first devnet surface and publishes one coherent model for sponsor programs, liabilities, claims, reserve accounting, and LP-facing capital.

It is intentionally a hard-break devnet migration rather than a compatibility release.

## Canonical nouns

- `ReserveDomain`: hard settlement, custody, and legal segregation boundary
- `DomainAssetVault`: custody per `[reserve_domain, asset_mint]`
- `HealthPlan`: sponsor/member/liability root
- `PolicySeries`: versioned product lane
- `FundingLine`: plan-side funding source
- `ClaimCase`: explicit claim lifecycle for reviewed flows
- `Obligation`: canonical liability unit
- `LiquidityPool`: LP-facing capital sleeve
- `CapitalClass`: investor instrument inside a pool
- `AllocationPosition`: capital-to-plan bridge

## Economic release notes

- sponsor budgets are explicit funding lines and do not mint LP exposure
- premiums, reserve booking, claims, and payouts reconcile through one reserve kernel
- shared capital inside a reserve domain is allowed only with explicit ledger attribution
- yield and impairment attribution live at the pool, class, and allocation level
- wrapper-mediated or regulated participation layers through reserve domains and capital classes instead of a forked protocol

## Frontend release notes

- the protocol console governance workspace now uses the plans-language redesign, including a telemetry-first KPI strip, asymmetric overview layout, and refreshed notice states
- the oracles workspace now matches the same plans and overview visual system so governance and oracle operations read as one shared control surface
- the hosted frontend keeps the canonical `v0.3.0` surface while improving workbench readability, queue visibility, and operator-facing chrome for the public deployment
- publish the matching docs update alongside the frontend deployment so [docs.omegax.health](https://docs.omegax.health/docs) reflects the current console experience

## Reviewer checklist

Before treating `v0.3.0` as publish-ready, confirm:

- `npm run anchor:idl`
- `npm run protocol:contract`
- `npm run verify:public`
- `npm run test:e2e:localnet`

Then confirm that the SDK and [docs.omegax.health](https://docs.omegax.health/docs) describe the same canonical surface before tagging or public announcement.
