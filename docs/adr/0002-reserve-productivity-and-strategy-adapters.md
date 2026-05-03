# ADR 0002: Reserve Productivity and Strategy Adapter Surface

## Status

Proposed on May 3, 2026.

## Context

ADR 0001 established the reserve kernel, LP capital classes, allocation positions,
and scoped ledgers as the canonical OmegaX protocol model. It deliberately left
external yield adapters as an open question because productive reserve introduces
a qualitatively different risk surface from claims, premium, and LP accounting.

The current program already has pieces that point toward the long-term vision:

- `record_premium_payment` books premium income into the reserve kernel and
  accrues protocol fees.
- `LiquidityPool` stores `strategy_hash`, `allowed_exposure_hash`, and
  `external_yield_adapter_hash`.
- `CapitalClass`, `LPPosition`, `PoolClassLedger`, and `AllocationLedger` track
  NAV, shares, realized distributions, realized yield, realized loss, and PnL
  placeholders.
- Pool and protocol fee vaults separate treasury claims from claims-paying
  reserve ledgers.

What does not exist yet is an executable strategy surface. There is no live
instruction for deploying reserve into DeFi, harvesting yield, recalling
principal, or recording strategy-specific impairment.

That absence is healthy for v1. If reserve funds can leave the domain vault for
yield, the protocol must prevent strategy execution from weakening claim
solvency, bypassing attribution, or turning the claims kernel into an arbitrary
DeFi router.

## Decision

OmegaX will add reserve productivity as a gated extension, not as an
unrestricted treasury feature.

The core `omegax_protocol` program remains the custody and accounting gate:

- it decides which reserve is free, restricted, encumbered, or impaired
- it enforces reserve floors and deployment caps
- it binds strategy movement to reserve domain, asset mint, pool, class, and
  allocation context
- it records realized yield and realized loss only after token movement is
  proven
- it owns emergency pause, recall, and impairment controls

External yield execution belongs in separate adapter programs or wrapper
programs:

- adapter-specific CPI logic does not live in the claims and reserve kernel
- adapter program IDs and strategy hashes are governance-registered
- adapters may never receive broad authority over unrelated reserve vaults
- a new adapter requires public review, test vectors, and a security signoff
  before funds move

Because the domain vault authority is controlled by the core program PDA, the
core program may still need narrow movement instructions that sign outbound and
inbound reserve transfers. Those instructions must be small gates around
registered adapters, not general-purpose routers.

## Yield Types

### Premium margin

Premiums are reserve inflows first. Underwriting surplus becomes distributable
only after the covered risk window, claim runoff, reserve floors, pending
obligations, protocol/oracle fees, and impairment checks are satisfied.

Premium margin is product economics, not strategy yield.

### Reserve strategy yield

Reserve strategy yield is earned only when it is realized, liquid, withdrawable,
and reconciled back through the reserve kernel. APY metadata, pending rewards,
or offchain yield estimates do not count as claims-paying reserve.

### Strategy principal

Principal deployed into a strategy is not free reserve. It must be treated as
restricted capacity until recalled and reconciled back into the domain vault.
A later audited version may assign conservative haircuts to strategy principal,
but the first executable surface should not count deployed principal as free
claims-paying liquidity.

## Proposed New Accounts

### YieldStrategyProfile

Governance-registered strategy policy for a reserve domain and asset rail.

Required fields:

- `reserve_domain`
- `asset_mint`
- `adapter_program`
- `strategy_id`
- `strategy_hash`
- `allowed_exposure_hash`
- `max_deploy_bps`
- `max_deploy_amount`
- `min_liquidity_floor`
- `liquidity_haircut_bps`
- `max_unwind_seconds`
- `pause_flags`
- `active`
- `audit_nonce`

### ReserveStrategyPosition

One active deployment position from an attributable reserve scope into one
registered strategy.

Required fields:

- `yield_strategy_profile`
- `reserve_domain`
- `asset_mint`
- `scope_kind`
- `scope`
- `domain_asset_vault`
- `principal_deployed`
- `principal_recalled`
- `realized_yield`
- `realized_loss`
- `pending_recall`
- `last_report_hash`
- `status`
- `opened_at`
- `updated_at`

The `scope_kind` and `scope` pair lets the same primitive support domain-wide,
pool-class, allocation, or funding-line strategies without hiding attribution.

## Proposed Instructions

### register_yield_strategy

Governance creates a `YieldStrategyProfile` for one reserve domain and asset
mint.

Required controls:

- governance or domain authority only
- adapter program ID must be explicit
- no native/project-token reserve shortcut; canonical reserve-quality rules still apply
- nonzero strategy and exposure hashes
- deployment caps and liquidity floor required at creation

### update_yield_strategy_controls

Governance updates caps, pause flags, active status, or policy hashes.

Required controls:

- changes emit a scoped audit event
- cap increases require a new reason hash
- paused strategies cannot receive new deployments
- recall remains available while deployment is paused

### open_strategy_position

Create a position binding one attributable reserve scope to one strategy.

Required controls:

- profile, reserve domain, asset mint, and scope must all match
- one open position per `[profile, scope]` unless governance explicitly allows
  multiple positions
- no position may be opened against encumbered-only capital

### deploy_free_reserve

Move free reserve into a registered strategy adapter.

Required controls:

- protocol emergency pause blocks deployment
- strategy pause blocks deployment
- deployment amount must be positive
- amount must be less than profile cap and position cap
- free reserve after deployment must stay above the configured floor
- deployed amount is booked as restricted capacity before or atomically with
  movement
- the CPI target must be the registered adapter program
- all remaining accounts must be checked against the adapter policy hash

### harvest_strategy_yield

Realize yield by moving tokens back into the domain vault and updating ledgers.

Required controls:

- yield is recorded only after token movement into the vault is verified
- principal and yield must be separated
- realized yield increases `PoolClassLedger.realized_yield_amount`,
  allocation PnL, or the relevant funding-line/surplus accounting according to
  the position scope
- harvested yield does not bypass protocol, oracle, or pool treasury fee rules

### recall_strategy_principal

Recall principal from a strategy into the domain vault.

Required controls:

- recall is allowed during strategy pause and emergency recall mode
- returned principal releases restricted capacity only after vault reconciliation
- shortfall is recorded as loss or pending recall, never ignored

### mark_strategy_impairment

Record a loss when strategy principal or expected returned assets are impaired.

Required controls:

- impairment must hit the correct scope and waterfall
- junior/first-loss classes absorb before senior classes where applicable
- impaired strategy principal cannot be treated as free reserve
- impairment emits a reason hash and keeps the strategy position auditable

### release_premium_surplus

Recognize underwriting surplus after risk has matured.

Required controls:

- coverage window and claim submission grace period must be over
- no unresolved claim case, payable amount, pending payout, or active appeal may
  remain for the covered scope
- reserve floor must still hold after surplus release
- surplus release is not strategy yield and must use separate events

## Security Invariants

The reserve productivity surface must satisfy these invariants before any
mainnet deployment:

1. No instruction can deploy `reserved`, `claimable`, `payable`,
   `pending_redemption`, `impaired`, or fee-claimed assets.
2. Deployed reserve is never counted as free claims-paying reserve.
3. Unrealized APY, pending reward tokens, and adapter-reported balances do not
   increase claims-paying reserve.
4. Yield is recognized only after tokens are back in the domain vault or in a
   custody account whose authority and asset rail are explicitly bound to the
   reserve domain.
5. Adapter program IDs are fixed by governance and cannot be supplied
   opportunistically by the caller.
6. Remaining accounts are either fully specified by the strategy profile or
   verified by a strategy-specific account policy hash.
7. A strategy can only move the asset mint it was registered for.
8. Strategy deployment cannot lower free reserve below the issuance floor,
   redemption floor, or emergency liquidity floor.
9. Emergency pause prevents new deployments; recall and impairment remain
   available.
10. Strategy losses hit ledgers before yield or surplus can be distributed.
11. LP redemption math cannot use deployed or pending-recall assets as free
   redemption liquidity.
12. No adapter can receive authority over the root domain vault or unrelated
   vault rails.
13. Native/project-token collateral cannot be marked as canonical stable reserve
   through a strategy path.
14. Every deployment, harvest, recall, and impairment emits a scoped event with
   reserve domain, asset mint, strategy profile, position, amount, and reason
   hash.

## Frontend and Operator Surfaces

The console should expose reserve productivity only after the read model can
show the underlying risk clearly.

New surfaces:

- Strategy registry panel
- Reserve liquidity floor card
- Free versus restricted versus deployed reserve card
- Strategy position table
- Harvest and recall action drawer
- Strategy impairment drawer
- Premium surplus release drawer
- Public disclosure block explaining that deployed reserve is not free reserve

The v1 Genesis Protect demo should continue to omit active yield generation.
Reserve productivity is a later treasury-efficiency layer, not the first member
trust story.

## Implementation Order

1. ADR and docs only.
2. Read-only UI for strategy hashes, adapter hashes, and reserve-productivity
   posture.
3. Add account types and no-funds-move instructions for registering strategy
   profiles and opening positions.
4. Add a localnet mock adapter and property tests for deployment, harvest,
   recall, and impairment.
5. Add `record_realized_strategy_yield` or `harvest_strategy_yield` with
   same-mint vault reconciliation.
6. Add one audited adapter at a time.
7. Enable capped production deployment only after security review and a
   governance signoff.

## Rejected Alternatives

### Put full DeFi logic in the core program

Rejected. It increases blast radius and turns the claims/reserve kernel into a
strategy router.

### Keep yield entirely offchain

Rejected as the target state. It may be acceptable during early operations, but
long-term reserve movement and realized yield must reconcile through protocol
state.

### Count expected yield as reserve

Rejected. Expected yield is not claims-paying capital.

### Let adapters choose their own account graph at runtime

Rejected. Remaining-account freedom is too dangerous for reserve custody.

## Consequences

Positive outcomes:

- reserve productivity can complete the capital-markets vision without
  weakening claims solvency
- yield adapters become reviewable, replaceable components
- the core protocol remains auditable
- members, sponsors, and LPs can see whether reserve is free, restricted,
  deployed, impaired, or realized as yield

Costs accepted:

- more account types and state transitions
- slower adapter rollout
- public security review before real yield deployment
- less short-term APY theater in favor of stronger reserve truth
