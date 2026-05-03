# `omegax_protocol`

This crate contains the canonical OmegaX Protocol onchain program.

## Current shape

The canonical Anchor facade lives in [`src/lib.rs`](./src/lib.rs). It declares
the program id, re-exports the public protocol types, and keeps every public
instruction present in `#[program] pub mod omegax_protocol`.

Instruction implementation now sits next to its account validation context in
audit-domain modules:

- [`src/governance.rs`](./src/governance.rs)
- [`src/reserve_custody.rs`](./src/reserve_custody.rs)
- [`src/plans_membership.rs`](./src/plans_membership.rs)
- [`src/funding_obligations/`](./src/funding_obligations/)
- [`src/commitments.rs`](./src/commitments.rs)
- [`src/claims.rs`](./src/claims.rs)
- [`src/capital/`](./src/capital/)
- [`src/fees.rs`](./src/fees.rs)
- [`src/oracle_schema.rs`](./src/oracle_schema.rs)
- [`src/kernel.rs`](./src/kernel.rs) and [`src/kernel/`](./src/kernel/) for shared authorization, math, transfer, and reserve-accounting helpers

Shared public surface types live in explicit modules:

- [`src/state.rs`](./src/state.rs) for account state and reserve-accounting structs
- [`src/args.rs`](./src/args.rs) for instruction args
- [`src/events.rs`](./src/events.rs) for events
- [`src/errors.rs`](./src/errors.rs) for errors
- [`src/constants.rs`](./src/constants.rs) for seeds, limits, modes, and flags

The active public object model is:

- `ProtocolGovernance`
- `ReserveDomain`
- `DomainAssetVault`
- `DomainAssetLedger`
- `HealthPlan`
- `PlanReserveLedger`
- `PolicySeries`
- `SeriesReserveLedger`
- `MemberPosition`
- `FundingLine`
- `FundingLineLedger`
- `CommitmentCampaign`
- `CommitmentLedger`
- `CommitmentPosition`
- `ClaimCase`
- `Obligation`
- `LiquidityPool`
- `CapitalClass`
- `PoolClassLedger`
- `LPPosition`
- `AllocationPosition`
- `AllocationLedger`

Restricted and wrapper-only capital classes now rely on managed `LPPosition` credentialing. Direct deposits do not carry a caller-supplied credential flag; access is granted on-chain through the canonical LP position for that class and owner.

Founder commitment campaigns are a narrow pre-activation primitive. Pending USDC, PUSD, WSOL, WBTC, WETH, and OMEGAX commitments sit in the existing `DomainAssetVault` custody lane, but they do not increase claims-paying reserve ledgers until an explicit activation instruction runs. `WATERFALL_RESERVE` activation books capacity through configured `ReserveAssetRail` controls: role, payout priority, oracle source, price freshness, haircut, and exposure cap. Stable rails pay first, volatile rails are discounted, and OMEGAX remains last in the waterfall. The v1 program does not sell, swap, or withdraw OMEGAX treasury inventory; if OMEGAX capacity is enabled, it must use an approved Chainlink/governance-attested price and conservative caps. Legacy `DIRECT_PREMIUM` and `TREASURY_CREDIT` modes remain for operator/backward workflows, not the new public Founder Travel30 path.

## Important reviewer rule

Treat `src/lib.rs` as the instruction/IDL facade and the domain modules above as
the implementation truth. Historical `core_accounts.rs` types have been removed
from the live program source so stale account layouts are not mistaken for the
current protocol surface.

## Orientation docs

- [`../../docs/adr/0001-health-capital-markets-rearchitecture.md`](../../docs/adr/0001-health-capital-markets-rearchitecture.md)
- [`../../docs/architecture/solana-program-architecture.md`](../../docs/architecture/solana-program-architecture.md)
- [`../../docs/architecture/solana-instruction-map.md`](../../docs/architecture/solana-instruction-map.md)
- [`../../docs/MIGRATION_MATRIX.md`](../../docs/MIGRATION_MATRIX.md)

## Common commands

From the repository root:

```bash
npm run rust:fmt:check
npm run rust:test
npm run rust:lint
npm run anchor:idl
npm run protocol:contract
```
