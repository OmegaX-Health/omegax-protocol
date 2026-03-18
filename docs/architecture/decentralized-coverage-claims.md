# Decentralized Coverage Claims

This note documents the current decentralized coverage-claim model in `omegax-protocol`, with an emphasis on who can sign what, how approved reimbursements get paid, and which instructions make up the supported claim lifecycle.

## Why this exists

Coverage claims should not require DAO governance to sign every review, approval, denial, or payout. Governance is the control plane. Day-to-day claims operations belong to delegated adjudicator keys that governance can rotate through the oracle registry.

The current protocol model separates those responsibilities like this:

- governance rotates trusted oracle/adjudicator keys and pool permissions
- claim adjudicator keys review, attach decision support, approve, deny, and optionally fast-settle claims
- claimants or active claim delegates pull approved reimbursements
- the compatibility operator push-payout path still exists, but it is no longer the primary reimbursement UX

## Trust model

Coverage claim adjudicators are not a separate bespoke authority account type. They are existing oracle identities that:

1. are registered in the oracle registry
2. are approved for the pool
3. hold `ORACLE_PERMISSION_CLAIM_SETTLE` in the pool permission set

That means the on-chain trust anchor is the adjudicator key, not an API endpoint or backend URL.

Relevant code:

- [`programs/omegax_protocol/src/surface/shared/oracle.rs`](../../programs/omegax_protocol/src/surface/shared/oracle.rs)
- [`programs/omegax_protocol/src/surface/contexts/coverage.rs`](../../programs/omegax_protocol/src/surface/contexts/coverage.rs)
- [`programs/omegax_protocol/src/surface/treasury.rs`](../../programs/omegax_protocol/src/surface/treasury.rs)

## Coverage claim roles

### Governance

- rotates oracle/adjudicator keys
- approves pool-oracle relationships
- assigns or removes `ORACLE_PERMISSION_CLAIM_SETTLE`
- can still handle exceptional disputes or broader pool controls

### Claim adjudicator

- must be a pool-approved oracle with `ORACLE_PERMISSION_CLAIM_SETTLE`
- may review claims
- may attach AI or attestation-backed decision-support metadata
- may approve claims
- may deny claims
- may fast-settle claims in one transaction when the product wants that flow

### Claimant

- submits the original coverage claim
- can pull payout after approval through `claim_approved_coverage_payout`

### Claim delegate

- may pull an approved payout on behalf of the claimant when an active `ClaimDelegateAuthorization` exists
- missing or inactive delegate authorization is treated as `DelegateNotAuthorized`

## Primary reimbursement flow

The default reimbursement flow is now:

1. `submit_coverage_claim`
2. `review_coverage_claim`
3. optional `attach_coverage_claim_decision_support`
4. `approve_coverage_claim` or `deny_coverage_claim`
5. if approved, claimant or delegate calls `claim_approved_coverage_payout`
6. optional `close_coverage_claim` once the case is fully resolved

This is the recommended OmegaX Protect reimbursement path because it keeps adjudication delegated while letting the actual claimant pull funds when ready.

## Supported payout paths

### 1. Pull payout for approved claims

`claim_approved_coverage_payout` is the primary decentralized reimbursement path.

Properties:

- caller may be the claimant or an active claim delegate
- funds still only go to claimant-owned recipient accounts
- supports partial payout and later completion
- releases reserved coverage liability as payout is consumed

### 2. Legacy operator push payout

`pay_coverage_claim` still exists.

Properties:

- useful for compatibility or operator-driven products
- not the preferred reimbursement path for decentralized community protection flows

### 3. Fast settle

`settle_coverage_claim` still exists as a one-transaction fast path.

Properties:

- signer on the adjudication side is a claim adjudicator oracle with `ORACLE_PERMISSION_CLAIM_SETTLE`
- claimant still signs the settlement
- best for simple products or low-friction operational flows
- not the primary reimbursement UX for reviewed claims

## SPL payout and vault rules

SPL-backed claim payouts and premium funding now assume the canonical associated token account owned by the `PoolAssetVault` PDA.

That means:

- `fund_pool_spl` uses the canonical vault ATA
- coverage premium SPL payments expect that same canonical vault ATA
- localnet and client flows should not create random signer-owned token accounts for the pool vault anymore

Relevant code:

- [`programs/omegax_protocol/src/surface/contexts/pools.rs`](../../programs/omegax_protocol/src/surface/contexts/pools.rs)
- [`programs/omegax_protocol/src/surface/coverage.rs`](../../programs/omegax_protocol/src/surface/coverage.rs)
- [`frontend/lib/protocol.ts`](../../frontend/lib/protocol.ts)

## Important implementation notes

- Coverage claim review, decision-support attachment, approval, denial, and fast-settle are oracle-permission driven.
- `claim_approved_coverage_payout` intentionally allows a missing delegate PDA to fall through to `DelegateNotAuthorized` instead of failing early with Anchor account initialization errors.
- The payout destination remains claimant-owned even when a delegate initiates the pull.
- Governance remains the authority-rotation layer, not the day-to-day claim signer.

## Public instructions involved

- `submit_coverage_claim`
- `review_coverage_claim`
- `attach_coverage_claim_decision_support`
- `approve_coverage_claim`
- `deny_coverage_claim`
- `claim_approved_coverage_payout`
- `pay_coverage_claim`
- `settle_coverage_claim`
- `close_coverage_claim`

## Tests that cover this

- [`tests/coverage_claim_case.test.ts`](../../tests/coverage_claim_case.test.ts)
- [`tests/protocol_contract.test.ts`](../../tests/protocol_contract.test.ts)
- [`e2e/localnet_protocol_surface.test.ts`](../../e2e/localnet_protocol_surface.test.ts)

The localnet surface suite covers:

- oracle-adjudicator review and decision actions
- claimant pull payout
- delegate pull payout
- partial payout followed by completion
- unauthorized delegate attempts
- recipient mismatch and payout-limit failures
- compatibility coverage for the push-payout path
