# `omegax_protocol`

This crate contains the canonical OmegaX Protocol onchain program.

## Current shape

The canonical public surface now lives in [`src/lib.rs`](./src/lib.rs).

That file contains:

- the Anchor entrypoints
- the canonical account definitions
- the reserve-kernel ledger structs
- the scoped-control events and errors
- the accounting helpers used by obligations, claims, liquidity, and allocation flows

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
- `ClaimCase`
- `Obligation`
- `LiquidityPool`
- `CapitalClass`
- `PoolClassLedger`
- `LPPosition`
- `AllocationPosition`
- `AllocationLedger`

## Important reviewer rule

Older module files still exist in the tree for historical context, but the canonical public program surface is the one declared in `src/lib.rs`. Review the current architecture and instruction map docs before treating older pool-first modules as active design truth.

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
