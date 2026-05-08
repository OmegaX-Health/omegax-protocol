# Changelog

## Weekly protocol + SDK update - 2026-05-08

This weekly entry covers public repo activity from 2026-05-01 through 2026-05-08 UTC. It is not a new tagged protocol release; the protocol package still advertises `0.3.1`, while the SDK release target advanced to `v0.8.7`.

### Protocol

#### Features

- Added selected-asset claim settlement and payout rails so claim flows can settle through configured reserve asset rails instead of assuming a single payout asset ([PR #72](https://github.com/OmegaX-Health/omegax-protocol/pull/72), [50991cb](https://github.com/OmegaX-Health/omegax-protocol/commit/50991cb), [84d5b6c](https://github.com/OmegaX-Health/omegax-protocol/commit/84d5b6c)).
- Added the Genesis Protect Travel 30 USDT founder rail, reset Travel 30 launch pricing to 99, and documented the WBTC/WETH commitment rails and mixed reserve waterfall path ([PR #39](https://github.com/OmegaX-Health/omegax-protocol/pull/39), [494f3b6](https://github.com/OmegaX-Health/omegax-protocol/commit/494f3b6), [06d1132](https://github.com/OmegaX-Health/omegax-protocol/commit/06d1132), [1c05a97](https://github.com/OmegaX-Health/omegax-protocol/commit/1c05a97), [a52e2a8](https://github.com/OmegaX-Health/omegax-protocol/commit/a52e2a8)).

#### Fixes

- Closed adversarial governance and redemption findings by gating governance initialization, binding optional reserve accounts to canonical PDAs, tightening allocation cap pool binding, and hardening liability state transitions ([PR #75](https://github.com/OmegaX-Health/omegax-protocol/pull/75), [8e9e1c1](https://github.com/OmegaX-Health/omegax-protocol/commit/8e9e1c1), [1081e1f](https://github.com/OmegaX-Health/omegax-protocol/commit/1081e1f), [33e6fe9](https://github.com/OmegaX-Health/omegax-protocol/commit/33e6fe9), [01e1b9e](https://github.com/OmegaX-Health/omegax-protocol/commit/01e1b9e), [d9fa872](https://github.com/OmegaX-Health/omegax-protocol/commit/d9fa872)).
- Hardened fee reserve accounting, LP allocation scope checks, claim attestation account binding, and cybersecurity guardrails used by devnet treasury rehearsal coverage ([f5e1880](https://github.com/OmegaX-Health/omegax-protocol/commit/f5e1880), [66c4a52](https://github.com/OmegaX-Health/omegax-protocol/commit/66c4a52), [f93512b](https://github.com/OmegaX-Health/omegax-protocol/commit/f93512b), [501249e](https://github.com/OmegaX-Health/omegax-protocol/commit/501249e)).

#### Improvements

- Added pre-mainnet security readiness gates, formal verification lanes, QEDgen starter wiring, and devnet replay evidence for the current protocol surface ([PR #74](https://github.com/OmegaX-Health/omegax-protocol/pull/74), [PR #73](https://github.com/OmegaX-Health/omegax-protocol/pull/73), [PR #71](https://github.com/OmegaX-Health/omegax-protocol/pull/71), [a3756f6](https://github.com/OmegaX-Health/omegax-protocol/commit/a3756f6), [c8b87a7](https://github.com/OmegaX-Health/omegax-protocol/commit/c8b87a7), [97c940b](https://github.com/OmegaX-Health/omegax-protocol/commit/97c940b), [df5dc50](https://github.com/OmegaX-Health/omegax-protocol/commit/df5dc50)).
- Refined the protocol console and public docs surface for Phase 0 mainnet boundaries, Genesis Protect buyer disclosures, and protocol-first public copy ([PR #69](https://github.com/OmegaX-Health/omegax-protocol/pull/69), [PR #68](https://github.com/OmegaX-Health/omegax-protocol/pull/68), [c71839c](https://github.com/OmegaX-Health/omegax-protocol/commit/c71839c), [1422e37](https://github.com/OmegaX-Health/omegax-protocol/commit/1422e37), [ea8fd90](https://github.com/OmegaX-Health/omegax-docs/commit/ea8fd90), [5d4f6f2](https://github.com/OmegaX-Health/omegax-docs/commit/5d4f6f2)).

#### Breaking changes

- Claim-settlement integrations that use selected-asset payouts now need the regenerated protocol contract/IDL shape and the configured payout rail accounts introduced by the selected-asset claim settlement work ([50991cb](https://github.com/OmegaX-Health/omegax-protocol/commit/50991cb), [84d5b6c](https://github.com/OmegaX-Health/omegax-protocol/commit/84d5b6c)).

### SDK

#### Features

- Synced `@omegax/protocol-sdk` with the current protocol surface and released the SDK line through `v0.8.7` ([PR #8](https://github.com/OmegaX-Health/omegax-sdk/pull/8), [PR #17](https://github.com/OmegaX-Health/omegax-sdk/pull/17), [721578a](https://github.com/OmegaX-Health/omegax-sdk/commit/721578a), [da5cf83](https://github.com/OmegaX-Health/omegax-sdk/commit/da5cf83)).
- Added typed SDK errors, top API guidance, recipes, consumer-app examples, and DX smoke/dogfood release gates for app builders and oracle operators ([PR #15](https://github.com/OmegaX-Health/omegax-sdk/pull/15), [1fef1a2](https://github.com/OmegaX-Health/omegax-sdk/commit/1fef1a2), [46f732b](https://github.com/OmegaX-Health/omegax-sdk/commit/46f732b), [61bf8c5](https://github.com/OmegaX-Health/omegax-sdk/commit/61bf8c5)).

#### Fixes

- Hardened safe settlement and oracle-scope verification, including protocol-bound oracle attestation checks and dependency audit coverage ([PR #10](https://github.com/OmegaX-Health/omegax-sdk/pull/10), [PR #11](https://github.com/OmegaX-Health/omegax-sdk/pull/11), [a8b043a](https://github.com/OmegaX-Health/omegax-sdk/commit/a8b043a), [9922aca](https://github.com/OmegaX-Health/omegax-sdk/commit/9922aca), [b09e116](https://github.com/OmegaX-Health/omegax-sdk/commit/b09e116), [20f0156](https://github.com/OmegaX-Health/omegax-sdk/commit/20f0156)).
- Tightened SDK release automation by fetching annotated tags, preserving docs ancestry checks, authenticating the private docs clone during release validation, and retrying post-publish registry smoke checks ([PR #18](https://github.com/OmegaX-Health/omegax-sdk/pull/18), [PR #19](https://github.com/OmegaX-Health/omegax-sdk/pull/19), [PR #20](https://github.com/OmegaX-Health/omegax-sdk/pull/20), [d0f92a7](https://github.com/OmegaX-Health/omegax-sdk/commit/d0f92a7), [de2ac08](https://github.com/OmegaX-Health/omegax-sdk/commit/de2ac08), [5c9f01d](https://github.com/OmegaX-Health/omegax-sdk/commit/5c9f01d)).

#### Improvements

- Updated the public docs surface for SDK `0.8.7`, including the SDK overview, release notes, recipes, typed error catalog, top APIs, and the Solana `uuid` warning ([ad85108](https://github.com/OmegaX-Health/omegax-docs/commit/ad85108), [83f9f7a](https://github.com/OmegaX-Health/omegax-docs/commit/83f9f7a), [b53e17d](https://github.com/OmegaX-Health/omegax-docs/commit/b53e17d), [7bfc1c6](https://github.com/OmegaX-Health/omegax-docs/commit/7bfc1c6)).

#### Breaking changes

- SDK consumers pinned below `v0.8.7` should upgrade before adopting the selected-asset payout, payout-rail, governance, and reserve-account binding surface from this week; the generated SDK docs and protocol types were refreshed against that newer protocol contract shape ([20f0156](https://github.com/OmegaX-Health/omegax-sdk/commit/20f0156), [da5cf83](https://github.com/OmegaX-Health/omegax-sdk/commit/da5cf83)).

## 0.3.1 - 2026-04-24

- Hardened reserve inflows so sponsor funding, premium payments, and LP deposits require checked SPL token transfers into the configured `DomainAssetVault` token account before reserve ledgers increase.
- Changed redemption accounting so queued and processed payout amounts are derived from LP shares and NAV instead of caller-supplied asset amounts.
- Extended emergency-pause enforcement to payout, claim, redemption, allocation, and impairment paths that can move reserve balances.
- Restricted redemption queue processing to curator/governance control and kept sentinel authority out of payout execution.
- Added binding checks for optional mutable reserve ledgers so treasury mutations cannot corrupt unrelated series, class, allocation, or funding-line accounts.
- Regenerated IDL, shared protocol contract artifacts, and frontend generated bindings for the new public surface.

## 0.3.0 - 2026-04-03

- Published the first canonical OmegaX health-capital-markets protocol surface for Solana devnet beta.
- Introduced explicit reserve domains, domain asset vaults, health plans, policy series, funding lines, obligations, liquidity pools, capital classes, allocation positions, oracle registry accounts, and outcome-schema registry accounts.
- Retired the overloaded pool-first devnet model in favor of one reserve-aware accounting kernel.
