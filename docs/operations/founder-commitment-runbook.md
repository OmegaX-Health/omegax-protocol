# Founder Commitment Runbook

Founder Travel30 commitments are a temporary launch flow for collecting intent and custodying committed tokens before the full quote, oracle, and purchase activation path is live.

## Terms

- First public campaign: Founder Travel30.
- Public commitment price: `$99`.
- Public route: `/protect/founder`.
- Refund window: opens 90 days after campaign start unless governance cancels the campaign, makes a material change, or marks a depositor ineligible earlier.
- Fees: no commitment fee, activation fee, or refund fee.
- Refund asset: same token amount and mint originally deposited.
- Existing `/protect/quote`, `/protect/checkout`, and `/protect/confirmation` surfaces remain preserved for later reactivation.

## Protocol Accounting

- Pending commitments use the existing `DomainAssetVault` for custody.
- Pending commitment deposits do not increase claims-paying reserve ledgers.
- Founder Travel30 is one public campaign with multiple `CommitmentPaymentRail` accounts, not one campaign per asset.
- Each `WATERFALL_RESERVE` payment rail activates against a same-asset Travel30 funding line and same-asset reserve ledgers. The waterfall is the ordered set of accepted reserve assets in one reserve domain; it is not an on-chain conversion of every accepted asset into one USDC premium line.
- `ReserveAssetRail` accounts define the mixed-reserve waterfall for each accepted asset: role, payout priority, oracle source, freshness window, price-confidence threshold, haircut, exposure cap, and whether deposits/payout/capacity are enabled.
- Stable rails should be ordered first. Launch priority is USDC first, PUSD second, USDT third, SOL/WSOL fourth, WBTC fifth, WETH sixth, and OMEGAX last.
- `WATERFALL_RESERVE` payment rails accept USDC, PUSD, USDT, SOL/WSOL, WBTC, WETH, or OMEGAX into the same reserve domain and later activate into that rail's same-asset reserve accounting only after the rail controls are valid.
- OMEGAX is not swapped or sold by the v1 protocol. It can be a commitment payment rail, but it is `capacity_enabled=false` and `payout_enabled=false` by default. It can become a last-resort selected payout rail only when governance explicitly enables it, the rail is confidence-bounded and fresh-priced, and it remains ordered after stable/SOL/WBTC/WETH rails.
- If an OMEGAX Chainlink feed is unavailable at launch, keep the OMEGAX rail `capacity_enabled=false` and `payout_enabled=false`. Any future enablement needs fresh approved pricing plus conservative `max_confidence_bps`, haircut, and exposure limits.
- Legacy `DIRECT_PREMIUM` and `TREASURY_CREDIT` modes remain available for old/operator workflows, but new public Founder Travel30 rails should use `WATERFALL_RESERVE`.

## Protocol Console Scope

- The public protocol helper exports PDA derivation and transaction builders for reserve-asset rail configuration/pricing, `create_commitment_campaign`, `create_commitment_payment_rail`, `deposit_commitment`, direct/treasury/waterfall activation, `refund_commitment`, and `pause_commitment_campaign`.
- These builders are public-safe primitives for operator surfaces and backend transaction preparation. They are not a buyer checkout in this repository.
- `deposit_commitment` and `refund_commitment` both carry the protocol governance PDA and are blocked by global emergency pause. Pending refunds remain the normal depositor exit while the refund window is open or the campaign is canceled, but only when the global protocol pause is clear.
- The Genesis setup panel surfaces the Founder Travel30 campaign, payment rail count, pending custody, pending coverage, waterfall activation, legacy treasury inventory, and refunds separately from claims-paying reserve.
- The operator console must continue to show pending commitment reserve impact as `0` until the activation authority executes a valid activation path.
- RWA policy metadata and parsers remain in the repo for future legal/product work, but active launch UX and default devnet fixtures hide RWA pathways unless a deliberate future flag enables them.

## Governance

- Campaign status changes use `pause_commitment_campaign` through plan control: plan admin, sponsor operator, or protocol governance authority.
- Activation uses the campaign's `activation_authority`. For production launch this should be a Squads-controlled authority, not an individual hot wallet.
- Reserve rail configuration and price publication are governance/oracle actions. SOL, WBTC, WETH, and OMEGAX rails must use conservative price-confidence thresholds, haircuts, and exposure caps because they are volatile assets.
- Refunds are user-initiated while the position is still pending and the refund window or cancellation condition is active.
- Activation and refund are one-way state transitions; a position cannot activate or refund twice.

## Operator Checklist

1. Create or confirm the target reserve domain, payment vault, health plan, Travel30 policy series, and same-asset Travel30 premium funding lines for each accepted waterfall mint.
2. Configure reserve rails for accepted assets. Start with USDC/PUSD/USDT stable rails, add SOL/WSOL, WBTC, and WETH only with live price sources, and add OMEGAX last with `capacity_enabled=false` and `payout_enabled=false` until its price feed/attestation is ready. Any rail with `capacity_enabled=true` or `payout_enabled=true` must have a non-`NONE` oracle source, nonzero oracle authority, nonzero staleness window, and nonzero `max_confidence_bps`.
3. Create the Founder Travel30 campaign once, then add `CommitmentPaymentRail` accounts for each accepted mint under that same campaign. For `WATERFALL_RESERVE`, the rail's `payment_asset_mint`, `coverage_asset_mint`, and `coverage_funding_line.asset_mint` must all match.
4. Keep public CTAs pointed at `/protect/founder` while commitment mode is live.
5. Monitor commitment ledgers separately from reserve funding ledgers.
6. Before activation, verify each payment rail maps to an active reserve asset rail, a same-asset funding line, and fresh confidence-bounded price data when capacity or payout is enabled. Unsafe oracle quality counts as zero claims-paying capacity.
7. Keep OMEGAX PDA-held and unsold; if used for selected-token payout or capacity, use it last in the waterfall after stable rails and SOL/WBTC/WETH.
