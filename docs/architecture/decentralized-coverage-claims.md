# Decentralized Coverage Claims

This note describes the **abstract** canonical protection-claim model after the health-capital-markets rearchitecture. For a **deterministic, end-to-end Genesis Protect Acute walkthrough** with worked happy-path and messy-path traces (incomplete evidence, more-info-needed, partial approval, denial-over-cap, deferred settlement), see [`./genesis-protect-claim-trace.md`](./genesis-protect-claim-trace.md).

## Why this exists

Protection products now reconcile through the same reserve kernel as rewards, but they still need an explicit reviewed-claim workflow.

The protocol therefore separates:

- policy state on the `HealthPlan`
- product economics on the `PolicySeries`
- funding responsibility on the `FundingLine`
- reviewed claim workflow on the `ClaimCase`
- liability and settlement state on the `Obligation`

## Trust model

Raw medical payloads, raw claims packets, and human workflow stay offchain.

Onchain claim state should hold only:

- claim identity and lifecycle state
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
- approves or denies claims through explicit adjudication
- can settle linked claim obligations after reserve is booked
- does not get arbitrary authority to move unrelated money outside claim-linked liabilities

### Oracle authority

- can reserve or release linked protection liabilities without taking over broader sponsor-budget control
- does not become the adjudicator for claim approval or the canonical settlement signer

### Member / beneficiary

- is the beneficiary named on the resulting `Obligation` or claim
- can inspect claim status and payout history through readers

## Canonical claim lifecycle

The canonical public flow is:

1. `open_claim_case`
2. `adjudicate_claim_case`
3. either:
   - `settle_claim_case` for unlinked claims, or
   - `reserve_obligation` -> `settle_obligation` for linked protection liabilities

The economic consequence is expressed through `Obligation` state transitions:

`open_claim_case` is intentionally authorization-bound at intake. The signer must either be the
claimant opening a claim for itself, or the plan's claim/plan operator opening the case through an
operator workflow for a nonzero claimant. The funding line must belong to the selected plan and
policy series, and the funding line must still be open. Off-chain buyer, eligibility, and coverage
activation systems own member eligibility before claims reach the protocol.

Evidence review payloads and oracle attestations are off-chain or adjunct-program concerns. The base
protocol stores only claim proof fingerprints, the claim case, adjudication amounts, optional linked
obligation, reserve impact, and settlement state.

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
- claim-case creation, adjudication, and linkage
- approved and settled claim states
- obligation linkage back to plan-side and capital-side funding
- linked claim cases mirroring reserve and settlement state from the obligation path
- reserve visibility during payout and post-settlement
