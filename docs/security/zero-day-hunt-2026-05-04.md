# Creative Devnet Zero-Day Hunt - 2026-05-04

**Scope:** authorized OmegaX Protocol devnet/local source review only. No
mainnet transactions, private-key discovery, or live-fund movement.

**Program:** `Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B`.

## Result

No unauthenticated devnet treasury drain was demonstrated. The live devnet
treasury runner still blocked all raw SPL vault drain attempts, and the richer
OmegaX linked-claim settlement probe now runs against a live seeded canary and
is blocked by on-chain authorization. Fee-vault and LP-redemption probes remain
limited by missing governance-authorized canary state.

One new high-priority accounting bug class was found and hardened in source:

## CSO-2026-05-04-01 - LP Allocation Scope Omission

**Severity:** high for operator-key compromise, accounting integrity, and
pre-mainnet reserve controls.

**Affected paths:**

- `reserve_obligation`
- `release_reserve`
- `settle_obligation`
- obligation-backed `mark_impairment`
- standalone `mark_impairment` on LP-allocation funding lines

**Problem:**

`validate_treasury_mutation_bindings` treated pool/allocation scoped accounts as
optional even when the obligation named a liquidity pool, capital class, or
allocation position. That meant a privileged or compromised operator path could
mutate domain, plan, and funding-line accounting while omitting the
`PoolClassLedger`, `AllocationPosition`, and `AllocationLedger` accounts that
should carry the same reserve, release, settlement, or impairment mutation.

This is not a random-wallet instant theft path, because the handlers still
require plan, claim, or governance authorities. It is still dangerous: if a
claims/operator key is compromised or the offchain operator builds a malformed
transaction, the global reserve can be consumed while the LP allocation scope
does not show the same encumbrance or loss.

**Fix landed:**

- Allocation-scoped obligations now require all three scoped accounts:
  `PoolClassLedger`, `AllocationPosition`, and `AllocationLedger`.
- Partial scope is rejected: liquidity pool, capital class, and allocation
  position must be present together.
- The supplied allocation position must match the obligation's liquidity pool,
  capital class, health plan, and funding line.
- Standalone impairment on a liquidity-pool-allocation funding line now also
  requires pool/allocation scoped accounts.

**Regression coverage:**

- `tests/security/allocation_scope_required_regression.test.ts`

## Other Attack Ideas Checked

- Raw SPL transfer out of PDA-owned vault token accounts: blocked by SPL Token
  owner checks on live devnet.
- Fee-vault recipient swap: source checks still bind withdrawals to configured
  recipients, but devnet has no initialized withdrawable fee vaults to exercise.
- Linked-claim payout diversion: source checks still bind recipient owner to the
  member or member-delegated recipient; the seeded devnet linked-claim canary is
  blocked before funds can move.
- LP redemption diversion: source checks still bind recipient owner to the LP
  owner; devnet has no pending LP redemption canary.
- Token-2022 custody confusion: existing classic SPL guard remains in place.

## Remaining Devnet Gaps

Before treating devnet as a full treasury-adversarial rehearsal, initialize
small canary states for:

- protocol fee vault with accrued SPL fees
- pool treasury vault with accrued SPL fees
- pool oracle fee vault with accrued SPL fees
- LP position with pending redemption shares
- LP-allocation funding line with an active allocation position and canary
  obligation

Then rerun:

```bash
npm run devnet:treasury:seed-canaries
npm run devnet:treasury:pen-test
```
