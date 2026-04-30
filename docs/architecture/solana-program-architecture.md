# Solana Program Architecture

This document explains the current OmegaX onchain architecture after the health-capital-markets rearchitecture.

## Read Order

Read in this order:

1. [`docs/adr/0001-health-capital-markets-rearchitecture.md`](../adr/0001-health-capital-markets-rearchitecture.md)
2. [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs) for the Anchor facade and public re-exports
3. [`docs/architecture/solana-instruction-map.md`](./solana-instruction-map.md)
4. The matching implementation module in `programs/omegax_protocol/src/`
5. [`docs/MIGRATION_MATRIX.md`](../MIGRATION_MATRIX.md)

## Canonical Layers

### 1. Governance and scoped controls

`ProtocolGovernance` holds protocol-wide upgrade and emergency authority.

`ReserveDomain`, `HealthPlan`, `CapitalClass`, and `AllocationPosition` each expose scoped controls instead of one blunt global switch. The important invariant is that scoped control changes are auditable without rewriting liabilities or historical settlements.

### 2. Reserve domains and custody truth

`ReserveDomain` is the hard segregation boundary.

Inside a domain:

- actual tokens sit in the SPL token account recorded on `DomainAssetVault`
- reserve attribution lives in `DomainAssetLedger`
- health plans and liquidity pools can share the same settlement asset without losing attribution

This is how the protocol supports shared capital without creating accounting soup.

Reserve ledgers must not increase from asserted offchain amounts alone. Funding, premium, and LP deposit instructions require checked SPL token transfers into the configured domain vault token account before ledger-backed balances increase.

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

Queued redemption assets are derived from class NAV and queued shares. Operators process queued shares; they do not supply the payout amount.

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

The canonical public instruction surface is declared in [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs). The facade delegates to domain modules that keep each handler near the `#[derive(Accounts)]` context it relies on:

- `governance.rs` for protocol governance and emergency controls
- `reserve_custody.rs` for reserve domains and domain asset vaults
- `plans_membership.rs` for health plans, policy series, and member positions
- `funding_obligations/` for funding lines, reserve movements, obligations, and obligation settlement
- `claims.rs` for claim lifecycle, direct claim settlement, and attestations
- `capital/` for liquidity pools, capital classes, LP positions, redemptions, allocations, and impairments
- `fees.rs` for fee-vault initialization and withdrawals
- `oracle_schema.rs` for oracle registry, pool oracle permissions/policies, and outcome schemas
- `kernel.rs` plus `kernel/` for shared auth, validation, math, token transfer, and reserve-accounting helpers
- `state.rs`, `args.rs`, `events.rs`, `errors.rs`, `constants.rs`, and `types.rs` for shared public and internal types

## Review Hotspots

If you are reviewing protocol changes, start with the facade in `src/lib.rs`,
then jump to the domain module for the changed instruction:

- reserve-domain creation and control flows
- plan and policy-series creation/versioning
- funding-line, claim-case, and obligation state transitions
- liquidity-pool, capital-class, and allocation flows
- reserve-kernel helpers in `src/kernel.rs` and `src/kernel/`

## Generated Boundaries

Generated public artifacts live in:

- [`idl/`](../../idl/)
- [`shared/`](../../shared/)
- [`frontend/lib/generated/`](../../frontend/lib/generated/)

Treat `src/lib.rs` as the IDL facade and the domain modules as implementation truth, then confirm that the generated artifacts stay aligned.
