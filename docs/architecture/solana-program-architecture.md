# Solana Program Architecture

This document explains how the on-chain OmegaX program is organized so a new reviewer can move from the public entrypoints to the state transitions without relying on tribal knowledge.

## Read order

Start in this order:

1. [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs) for the Anchor entrypoint surface
2. [`programs/omegax_protocol/src/core_accounts.rs`](../../programs/omegax_protocol/src/core_accounts.rs) for root account types shared across the protocol
3. [`programs/omegax_protocol/src/surface.rs`](../../programs/omegax_protocol/src/surface.rs) for the current module index
4. the relevant handler file for the lifecycle you care about
5. the matching file under `src/surface/contexts/` for Anchor account validation
6. [`programs/omegax_protocol/src/surface/state.rs`](../../programs/omegax_protocol/src/surface/state.rs) for current account storage
7. the matching helper file under `src/surface/shared/` for reusable validation, quote, liquidity, treasury, or coverage logic

## Top-level layers

### 1. Anchor entrypoints

- `src/lib.rs` is the public instruction surface.
- Registry approval instructions still live inline there.
- The rest of the program delegates immediately into the current domain handlers so the entrypoint file stays routing-focused.

### 2. Root account types

- `src/core_accounts.rs` holds the root accounts that multiple protocol areas depend on:
  - `Pool`
  - `OracleRegistryEntry`
  - `OracleProfile`
  - `PoolOracleApproval`
  - `MembershipRecord`
- It also keeps the `register_oracle` and `set_pool_oracle` account contexts close to the state they operate on.

### 3. Current Domain Surface

- `src/surface.rs` is the current module index and shared import surface.
- Handler files are grouped by lifecycle:
  - `admin.rs` for governance and oracle administration
  - `pools.rs` for pool creation, enrollment, and liquidity
  - `rewards.rs` for attestation and reward claims
  - `coverage.rs` for product and policy flows
  - `cycles/activation.rs` and `cycles/settlement.rs` for quoted cycle lifecycles
  - `treasury.rs` for treasury, premium, and payout flows
- `events.rs` defines the stable wallet- and reporting-facing event payloads emitted across those handlers.

### 4. Account validation

- `src/surface/contexts/` contains the Anchor `#[derive(Accounts)]` definitions grouped by protocol area.
- The most complex validation surfaces today are:
  - `contexts/pools.rs`
  - `contexts/coverage.rs`
  - `contexts/cycles.rs`
  - `contexts/treasury.rs`
- Each `UncheckedAccount` in those files is paired with an inline safety comment describing what the instruction validates manually.

### 5. State and helpers

- `src/surface/state.rs` contains the current account layouts and `space()` helpers.
- `src/surface/shared/` contains helper logic grouped by protocol concern:
  - `guards.rs` for paused/closed checks
  - `compliance.rs` for action-level credential and rail gating
  - `oracle.rs` for oracle profile and permission validation
  - `risk.rs` for per-pool claim/redemption mode gates and impairment config bootstrap
  - `rules.rs` for schema/rule binding checks
  - `quotes.rs` for detached quote verification
  - `liquidity.rs` for share math, class-aware reference-NAV snapshots, free-capital-aware redemption logic, and redemption-request state transitions
  - `coverage.rs`, `premium.rs`, and `treasury.rs` for coverage, claim-case, and liability-ledger bookkeeping

## Main protocol lifecycles

### Governance and oracle lifecycle

- Bootstrap with `initialize_protocol`.
- Register and claim oracle identity with `register_oracle` and `claim_oracle`.
- Update profile and metadata through the admin/oracle flows.
- Stake, request unstake, finalize unstake, and slash through `admin.rs`.

### Pool lifecycle

- Create the pool and its companion policy/terms accounts in `create_pool`.
- Configure pool status, oracle policy, reserve floor, scoped risk controls, series metadata, compliance policy, delegated control authorities, automation policy, rules, and invite issuers in `pools.rs`.
- Enroll members through open, token-gated, or invite-based flows.
- Fund and manage liquidity through the same domain file today, including capital-class registration plus direct and queued redemption paths.

### Reward lifecycle

- Oracles submit attestation votes in `rewards.rs`.
- Cycle outcomes are finalized there as well, with optional challenge windows and dispute state.
- Attestation votes can now anchor evidence, AI/automation metadata, execution-environment commitments, and external-attestation references without putting raw artifacts onchain.
- Reward claims then read the finalized state, enforce claimable review status, and release the payout.

### Coverage and cycle lifecycle

- Coverage products and payment options are defined in `coverage.rs`.
- Cycle activation is quoted and verified in `cycles/activation.rs`.
- Cycle settlement and cohort settlement roots live in `cycles/settlement.rs`.
- Coverage claims and premium attestations settle treasury state in `treasury.rs`.
- Coverage claims now support explicit review, approval, denial, partial payout, closure, appeal count, recovery bookkeeping, optional compliance gating, and AI decision-support commitments without storing raw external payloads onchain.
- Coverage claim adjudication is delegated through pool-approved oracle keys with `ORACLE_PERMISSION_CLAIM_SETTLE`, while approved reimbursement claims can be pulled by the claimant or an active claim delegate instead of forcing governance or pool authority to push each payout.
- `PoolTreasuryReserve` now acts as the beginning of a liability ledger, so liquidity and claim payouts reconcile against free capital instead of gross reserves alone.
- `PoolRiskConfig` complements that ledger by letting the pool authority or governance pause claim intake, move redemptions to queue-only, or book an impairment amount without changing the pool’s broader lifecycle status.
- The current share mint is now treated explicitly as a transitional compatibility path: `PoolCapitalClass` wraps that share mint with class mode, restriction, vintage, and queue metadata, while `shared/liquidity.rs` exposes reserve-aware reference NAV, utilization, available-redemption semantics, and redemption-request lifecycle semantics from the combined class, risk, and treasury state.
- `PolicySeries`, `PoolCompliancePolicy`, `PoolControlAuthority`, and `PoolAutomationPolicy` give the kernel stable public comparability, regulated-mode, authority-boundary, and bounded-autonomy surfaces without replacing the pool root.
- `frontend/lib/protocol.ts` now also exposes wallet-native position builders that separate member rights from capital exposure by combining membership, reward-claim, coverage-claim, and capital-metrics readers into one consumable view for apps and future SDK surfaces.
- That same client surface now carries explicit integration-policy rules derived from `PoolCapitalClass`: reference NAV is the authoritative valuation surface, wrapper-only and restricted classes are called out distinctly, market price is treated as downstream rather than authoritative, and collateral or external-yield reuse remains disabled until a later phase makes it explicit.

## Largest review hotspots

These are the first files to revisit when readability or modularity needs improvement:

- `src/lib.rs`
- `src/surface/pools.rs`
- `src/surface/cycles/activation.rs`

Those files are the current concentration points for routing, onboarding/lifecycle branching, and quote-driven cycle activation.

## Generated versus hand-edited boundaries

Hand-edited protocol source lives in:

- `programs/omegax_protocol/src/`
- `docs/architecture/`
- `docs/operations/`

Generated or synced artifacts live outside the program source tree:

- `idl/`
- `shared/`
- `android-native/protocol/`

Review protocol logic in `src/` first, then use the generated artifacts to confirm the public surface stayed aligned.
