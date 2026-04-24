# Release `v0.3.1`

`v0.3.1` is a security and accounting hardening release for the canonical OmegaX health-capital-markets protocol surface.

## Release Meaning

This patch keeps the current `v0.3.x` public model in place while tightening the treasury, redemption, pause, and ledger-binding invariants that protect reserve-backed flows.

It is a protocol-surface release because several instruction account metas and argument shapes changed. Downstream SDKs and operator tooling must use regenerated IDL and protocol contract artifacts.

## Security Release Notes

- `fund_sponsor_budget`, `record_premium_payment`, and `deposit_into_capital_class` now require checked SPL token transfers into the configured domain vault token account before reserve ledgers or `DomainAssetVault.total_assets` increase.
- `request_redemption` and `process_redemption_queue` no longer accept caller-supplied asset payout amounts. Redemption assets are derived from queued shares and current class NAV.
- Emergency pause now blocks payout, claim-settlement, redemption, allocation, and impairment paths that can move or reduce reserve-backed accounting balances.
- `process_redemption_queue` now requires curator/governance control instead of broad pool control, keeping sentinel authority limited to defensive operations.
- Optional mutable reserve ledgers are validated against the expected series, class, allocation, funding line, reserve domain, and asset mint before mutation.

## SDK and Operator Impact

- Inflow builders must provide source token account, vault token account, asset mint, and token program accounts for custody-moving flows.
- `create_domain_asset_vault` requires a concrete vault token account. A zero or missing vault token account is rejected.
- Redemption builders should pass shares only; asset payout is an on-chain derived value.
- SDK consumers should upgrade to `@omegax/protocol-sdk v0.8.3` for regenerated IDL, generated types, and builder signatures.

## Verification

Before publishing or tagging this release, run:

```bash
npm run anchor:idl
npm run protocol:contract
npm run verify:public
```

For release-candidate sign-off, also run:

```bash
npm run devnet:operator:drawer:sim
npm run test:e2e:localnet
```
