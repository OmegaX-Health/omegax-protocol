# Decentralized Coverage Claims

This note describes the canonical protection-claim model after the health-capital-markets rearchitecture.

## Why this exists

Protection products now reconcile through the same reserve kernel as rewards, but they still need an explicit reviewed-claim workflow.

The protocol therefore separates:

- policy and membership state on the `HealthPlan`
- product economics on the `PolicySeries`
- funding responsibility on the `FundingLine`
- reviewed claim workflow on the `ClaimCase`
- liability and settlement state on the `Obligation`

## Trust model

Raw medical payloads, raw claims packets, and human workflow stay offchain.

Onchain claim state should hold only:

- claim identity and lifecycle state
- evidence or decision-support references
- adjudication consequence
- reserve booking and release consequence
- settlement consequence

This keeps the economic truth portable without turning the chain into a case-management backend.

## Claim roles

### Plan admin / sponsor operator

- configures the plan, series, and funding lines
- sets the plan-level operational controls
- does not silently rewrite approved or settled liabilities

### Claims operator / adjudicator

- opens materially relevant `ClaimCase` records when needed
- attaches evidence or decision-support references
- approves or denies claims through explicit adjudication
- does not get arbitrary authority to move unrelated money

### Member / beneficiary

- holds plan and series participation through `MemberPosition`
- is the beneficiary named on the resulting `Obligation`
- can inspect claim status and payout history through readers

## Canonical claim lifecycle

The canonical public flow is:

1. `open_claim_case`
2. optional `attach_claim_evidence_ref`
3. `adjudicate_claim_case`
4. `settle_claim_case`

The economic consequence is expressed through `Obligation` state transitions:

- proposed
- reserved
- claimable or payable
- settled
- canceled
- impaired
- recovered

## Funding and reserve truth

Protection claims do not settle against an abstract sponsor bucket.

Each material claim links back to:

- one `ReserveDomain`
- one `HealthPlan`
- one `PolicySeries`
- one `FundingLine`
- optional `LiquidityPool`, `CapitalClass`, and `AllocationPosition` when LP capital is part of the funding stack

That keeps it possible to answer:

- which funding line is responsible
- which capital class is exposed
- how much is reserved
- how much is payable
- what remains free or redeemable

## Reviewer path

For the live program surface, start with:

- [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs)
- [`docs/architecture/solana-instruction-map.md`](./solana-instruction-map.md)
- [`frontend/lib/protocol.ts`](../../frontend/lib/protocol.ts)

## Tests that cover this

- [`tests/scenario_matrix.test.ts`](../../tests/scenario_matrix.test.ts)
- [`tests/protocol_contract.test.ts`](../../tests/protocol_contract.test.ts)
- [`e2e/localnet_protocol_surface.test.ts`](../../e2e/localnet_protocol_surface.test.ts)

The localnet audit covers:

- explicit protection-series premium funding
- claim-case creation and linkage
- approved and settled claim states
- obligation linkage back to plan-side and capital-side funding
- reserve visibility during payout and post-settlement
