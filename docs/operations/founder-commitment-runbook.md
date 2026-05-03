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
- Founder Travel30 is one public campaign with multiple `CommitmentPaymentRail` accounts, not one campaign per asset.
- `ReserveAssetRail` accounts define the mixed-reserve waterfall for each accepted asset: role, payout priority, oracle source, freshness window, haircut, exposure cap, and whether deposits/payout/capacity are enabled.
- Stable rails should be ordered first. Launch priority is USDC first, PUSD second, SOL/WSOL after stable rails, and OMEGAX last.
- `WATERFALL_RESERVE` payment rails accept USDC, PUSD, SOL/WSOL, or OMEGAX into the same reserve domain and later activate into reserve accounting only after the rail controls are valid.
- OMEGAX is not swapped or sold by the v1 protocol. It can only count as active claims capacity when a configured reserve rail has a fresh approved price, an explicit haircut, an exposure cap, and payout priority after stable rails.
- If an OMEGAX Chainlink feed is unavailable at launch, set the OMEGAX rail `capacity_enabled=false` until governance configures the feed or an approved oracle authority publishes a governance-attested price.
- Legacy `DIRECT_PREMIUM` and `TREASURY_CREDIT` modes remain available for old/operator workflows, but new public Founder Travel30 rails should use `WATERFALL_RESERVE`.

## Protocol Console Scope

- The public protocol helper exports PDA derivation and transaction builders for reserve-asset rail configuration/pricing, `create_commitment_campaign`, `create_commitment_payment_rail`, `deposit_commitment`, direct/treasury/waterfall activation, `refund_commitment`, and `pause_commitment_campaign`.
- These builders are public-safe primitives for operator surfaces and backend transaction preparation. They are not a buyer checkout in this repository.
- The Genesis setup panel surfaces the Founder Travel30 campaign, payment rail count, pending custody, pending coverage, waterfall activation, legacy treasury inventory, and refunds separately from claims-paying reserve.
- The operator console must continue to show pending commitment reserve impact as `0` until the activation authority executes a valid activation path.

## Governance

- Campaign status changes use `pause_commitment_campaign` through plan control: plan admin, sponsor operator, or protocol governance authority.
- Activation uses the campaign's `activation_authority`. For production launch this should be a Squads-controlled authority, not an individual hot wallet.
- Reserve rail configuration and price publication are governance/oracle actions. OMEGAX and SOL rails must use conservative haircuts and exposure caps because they are volatile assets.
- Refunds are user-initiated while the position is still pending and the refund window or cancellation condition is active.
- Activation and refund are one-way state transitions; a position cannot activate or refund twice.

## Operator Checklist

1. Create or confirm the target reserve domain, payment vault, health plan, Travel30 policy series, and Travel30 premium funding line.
2. Configure reserve rails for accepted assets. Start with USDC/PUSD stable rails, add SOL/WSOL only with a live price source, and add OMEGAX last with `capacity_enabled=false` until its price feed/attestation is ready.
3. Create the Founder Travel30 campaign once, then add `CommitmentPaymentRail` accounts for each accepted mint under that same campaign.
4. Keep public CTAs pointed at `/protect/founder` while commitment mode is live.
5. Monitor commitment ledgers separately from reserve funding ledgers.
6. Before activation, verify each payment rail maps to an active reserve asset rail with fresh price data when capacity is enabled.
7. Keep OMEGAX PDA-held and unsold; if used for capacity, use it last in the waterfall after stable rails and SOL/WSOL.
