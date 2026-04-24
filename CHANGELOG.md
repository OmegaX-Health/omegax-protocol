# Changelog

## 0.3.1 - 2026-04-24

- Hardened reserve inflows so sponsor funding, premium payments, and LP deposits require checked SPL token transfers into the configured `DomainAssetVault` token account before reserve ledgers increase.
- Changed redemption accounting so queued and processed payout amounts are derived from LP shares and NAV instead of caller-supplied asset amounts.
- Extended emergency-pause enforcement to payout, claim, redemption, allocation, and impairment paths that can move reserve balances.
- Restricted redemption queue processing to curator/governance control and kept sentinel authority out of payout execution.
- Added binding checks for optional mutable reserve ledgers so treasury mutations cannot corrupt unrelated series, class, allocation, or funding-line accounts.
- Regenerated IDL, shared protocol contract artifacts, frontend generated bindings, and Android protocol contract bindings for the new public surface.

## 0.3.0 - 2026-04-03

- Published the first canonical OmegaX health-capital-markets protocol surface for Solana devnet beta.
- Introduced explicit reserve domains, domain asset vaults, health plans, policy series, funding lines, obligations, liquidity pools, capital classes, allocation positions, oracle registry accounts, and outcome-schema registry accounts.
- Retired the overloaded pool-first devnet model in favor of one reserve-aware accounting kernel.
