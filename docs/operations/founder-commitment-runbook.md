# Founder Commitment Runbook

Founder Travel30 commitments are a temporary launch flow for collecting intent and custodying committed tokens before the full quote, oracle, and purchase activation path is live.

## Terms

- First public campaign: Founder Travel30.
- Public commitment price: `$159`.
- Public route: `/protect/founder`.
- Refund window: opens 90 days after campaign start unless governance cancels the campaign, makes a material change, or marks a depositor ineligible earlier.
- Fees: no commitment fee, activation fee, or refund fee.
- Refund asset: same token amount and mint originally deposited.
- Existing `/protect/quote`, `/protect/checkout`, and `/protect/confirmation` surfaces remain preserved for later reactivation.

## Protocol Accounting

- Pending commitments use the existing `DomainAssetVault` for custody.
- Pending commitment deposits do not increase claims-paying reserve ledgers.
- `DIRECT_PREMIUM` campaigns accept stable premium assets such as USDC/PUSD and can later activate into premium reserve accounting.
- `TREASURY_CREDIT` campaigns accept OMEGAX as treasury-credit inventory.
- OMEGAX is never swapped, oracle-priced, sold, or counted as stable reserve in v1.
- OMEGAX treasury inventory remains PDA-held in v1. There is no v1 treasury withdrawal instruction.
- OMEGAX activation requires separately posted stable capacity; activation locks that capacity with `restricted` accounting.

## Protocol Console Scope

- The public protocol helper exports PDA derivation and transaction builders for `create_commitment_campaign`, `deposit_commitment`, both activation paths, `refund_commitment`, and `pause_commitment_campaign`.
- These builders are public-safe primitives for operator surfaces and backend transaction preparation. They are not a buyer checkout in this repository.
- The Genesis setup panel surfaces Founder Travel30 campaigns, pending custody, pending coverage, direct-premium activation, treasury inventory, and refunds separately from claims-paying reserve.
- The operator console must continue to show pending commitment reserve impact as `0` until the activation authority executes a valid activation path.

## Governance

- Campaign status changes use `pause_commitment_campaign` through plan control: plan admin, sponsor operator, or protocol governance authority.
- Activation uses the campaign's `activation_authority`. For production launch this should be a Squads-controlled authority, not an individual hot wallet.
- Refunds are user-initiated while the position is still pending and the refund window or cancellation condition is active.
- Direct premium activation and treasury-credit activation are one-way state transitions; a position cannot activate or refund twice.

## Operator Checklist

1. Create or confirm the target reserve domain, payment vault, health plan, Travel30 policy series, and Travel30 premium funding line.
2. Create the campaign with the correct payment mint, coverage mint, mode, refund date, terms hash, activation authority, and hard cap.
3. Keep public CTAs pointed at `/protect/founder` while commitment mode is live.
4. Monitor commitment ledgers separately from reserve funding ledgers.
5. Before activation, verify either same-mint direct premium mode or separately posted stable capacity for treasury-credit mode.
6. Keep OMEGAX inventory PDA-held unless a later audited governance proposal adds a withdrawal or treasury-management instruction.
