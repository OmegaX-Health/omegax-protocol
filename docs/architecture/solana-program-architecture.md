# Solana Program Architecture

This document explains the current OmegaX onchain architecture after the health-capital-markets rearchitecture.

## Read Order

Read in this order:

1. [`docs/adr/0001-health-capital-markets-rearchitecture.md`](../adr/0001-health-capital-markets-rearchitecture.md)
2. [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs)
3. [`docs/architecture/solana-instruction-map.md`](./solana-instruction-map.md)
4. [`docs/MIGRATION_MATRIX.md`](../MIGRATION_MATRIX.md)

## Canonical Layers

### 1. Governance and scoped controls

`ProtocolGovernance` holds protocol-wide upgrade and emergency authority.

`ReserveDomain`, `HealthPlan`, `CapitalClass`, and `AllocationPosition` each expose scoped controls instead of one blunt global switch. The important invariant is that scoped control changes are auditable without rewriting liabilities or historical settlements.

### 2. Reserve domains and custody truth

`ReserveDomain` is the hard segregation boundary.

Inside a domain:

- actual tokens sit in `DomainAssetVault`
- reserve attribution lives in `DomainAssetLedger`
- health plans and liquidity pools can share the same settlement asset without losing attribution

This is how the protocol supports shared capital without creating accounting soup.

### 3. Plan-side product and liability model

`HealthPlan` is the sponsor/member/liability root.

`PolicySeries` versions product semantics under a plan. Material economics are versioned by creating a new series, not by mutating the live one.

`FundingLine` records where plan-side money comes from:

- sponsor budget
- premiums
- LP allocation
- backstop
- subsidy

`ClaimCase` and `Obligation` make economically material rights and liabilities explicit instead of letting them disappear into operator workflow.

### 4. Capital-side investor model

`LiquidityPool` is the LP-facing sleeve.

`CapitalClass` carries class-specific redemption, restriction, and impairment semantics.

`LPPosition` records the investor position.

`AllocationPosition` is the bridge from a capital class into a plan funding line. This keeps investor exposure explicit and many-to-many.

### 5. Reserve kernel

The reserve kernel is implemented as scoped ledgers rather than one giant monolithic account:

- `DomainAssetLedger`
- `PlanReserveLedger`
- `SeriesReserveLedger`
- `FundingLineLedger`
- `PoolClassLedger`
- `AllocationLedger`

Every economically meaningful transition updates the relevant ledgers atomically.

The key questions the kernel must always answer are:

- what is funded
- what is allocated
- what is reserved
- what is owed
- what is claimable or payable
- what is impaired
- what is still free or redeemable capital

## File Reality

The canonical public surface is currently defined directly in [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs).

## Review Hotspots

If you are reviewing protocol changes, start with these areas in `src/lib.rs`:

- reserve-domain creation and control flows
- plan and policy-series creation/versioning
- funding-line, claim-case, and obligation state transitions
- liquidity-pool, capital-class, and allocation flows
- reserve-kernel helper functions near the bottom of the file

## Generated Boundaries

Generated public artifacts live in:

- [`idl/`](../../idl/)
- [`shared/`](../../shared/)
- [`android-native/protocol/`](../../android-native/protocol/)

Treat `src/lib.rs` as implementation truth, then confirm that the generated artifacts stay aligned.
