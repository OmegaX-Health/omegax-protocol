# OmegaX Protocol Vision and Capability Narrative

## Branch Context

Current implementation branch: `codex/quasar-trimming`.

This branch is the lean Quasar-trimmed protocol surface. It restores claim proof
fingerprints and adds simple reserve-capital contribution tracking without
bringing back the former governance, token, LP, redemption, or attestation
surface.

## Core Vision

OmegaX Protocol is an on-chain reserve, claim, and settlement backbone for
community-owned health protection.

Traditional insurance is a black box. Members pay premiums to a company, the
company controls reserves, the company decides claims, and the company keeps the
float and yield. Members usually cannot inspect the reserve truth behind the
promise.

OmegaX flips that into a community reserve model:

- a community, sponsor, school, company, or network state creates its own health
  protection plan
- premiums, sponsor funds, subsidies, and backstop capital are posted into
  explicit reserve buckets
- claims are reviewed by authorized operators and oracle workflows
- approved payouts come from visible reserve accounting
- proof is auditable without exposing private medical data
- contributors can help back the pool and later receive off-chain pricing,
  credit, or reward benefits

The protocol does not replace doctors, claim reviewers, pricing models, or
operator workflows. It gives them a transparent financial backbone: money in,
reserve state, claim decision, money reserved, money paid, contributor capital,
and proof fingerprints.

## What The Protocol Enables

OmegaX can support multiple community health protection products, for example:

- Network School Travel 30
- Event 7 emergency cover
- Web3 team health protection
- founder or member acute care coverage
- future specialized protection lanes for network states or sponsor groups

Each product can have its own policy series, terms hashes, pricing hashes,
funding lines, claim operators, and reserve accounting. Products can share one
reserve domain when the community wants pooled strength, or use separate reserve
domains when legal, custody, or risk boundaries must be ring-fenced.

## Current Public Accounts

`ReserveDomain` is the top-level custody or legal settlement boundary.

`DomainAssetVault` is token custody for one reserve domain and one asset mint,
such as a USDC vault.

`DomainAssetLedger` is the reserve accounting sheet for a whole domain and
asset.

`HealthPlan` is the community or sponsor plan. It stores plan control roles,
claims operators, oracle authority, pause controls, and plan identity.

`PlanReserveLedger` is reserve accounting for one health plan and asset.

`PolicySeries` is a product or versioned lane inside a plan, such as Travel 30
or Event 7.

`FundingLine` is a specific money source: sponsor budget, premium income,
backstop, or subsidy.

`FundingLineLedger` is reserve accounting for one funding line and asset.

`CapitalContribution` tracks simple backstop deposits by contributor. It stores
who deposited, which funding line they backed, how much they contributed, how
much was returned, and the terms hash.

`ClaimCase` tracks claim review, proof fingerprints, adjudication result,
reserve impact, and payout state.

`Obligation` is the canonical liability object. It formalizes what is proposed,
reserved, payable, settled, canceled, impaired, or recovered.

## Current Program Functions

Reserve and plan setup:

- `create_reserve_domain`
- `update_reserve_domain_controls`
- `create_domain_asset_vault`
- `create_health_plan`
- `update_health_plan_controls`
- `create_policy_series`
- `version_policy_series`

Funding and reserve accounting:

- `open_funding_line`
- `fund_sponsor_budget`
- `record_premium_payment`
- `deposit_reserve_capital`
- `return_reserve_capital`
- `record_reserve_earnings`

Claims and liabilities:

- `open_claim_case`
- `authorize_claim_recipient`
- `adjudicate_claim_case`
- `create_obligation`
- `reserve_obligation`
- `release_reserve`
- `settle_obligation`
- `settle_claim_case`

## Capital And Yield Model

The current program tracks contributor facts, not automated APY.

When someone deposits backstop capital, the chain knows:

- who deposited
- which funding line they backed
- how much they contributed
- how much has been returned
- which terms hash applies

This makes the deposit auditable and useful for off-chain pricing logic. The
quote oracle or operator system can read the contribution record and decide
whether the contributor receives a cheaper premium, credit, manual reward, or
future automated benefit.

Realized reserve earnings can be recorded only after same-mint tokens are
transferred back into the domain vault, and each recording carries a nonzero
reference hash. Deployed principal, unrealized APY, and adapter-reported rewards
do not count as free claims-paying reserve.

## Claim Privacy And Auditability

Raw medical evidence and adjudication packages stay off-chain.

The base program stores only two 32-byte proof fingerprints on `ClaimCase`:

- `evidence_ref_hash`
- `decision_support_hash`

That means the chain can prove which evidence bundle and decision package were
used without publishing private medical data.

## Retired Surface

The trimmed protocol intentionally removed the bulky surfaces that made the
program expensive and harder to reason about:

- protocol governance
- protocol token and token-gating
- fee vaults
- liquidity pools
- capital classes
- LP positions
- allocation positions
- redemption queues
- impairment handlers
- oracle registry
- schema registry
- reserve asset price rails
- on-chain `ClaimAttestation`

Those may exist as roadmap ideas, adjunct programs, or off-chain services, but
they are not part of the current base program.

## Current Narrative

OmegaX lets communities build and own their own health protection layer.

The community can collect sponsor funds and premiums, accept simple backstop
capital, track claims, reserve money for payouts, and publish auditable reserve
history. Members do not need to trust a black-box insurer to know whether the
pool exists or whether a payout was made.

The base program stays intentionally narrow. It does not price medical risk,
calculate yield, expose medical documents, or automate all governance. It
anchors the financial truth that those systems need.

That is the foundation for insurance-like products where communities own the
reserve, operators review claims, contributors can help capitalize the pool, and
members can eventually make coverage cheaper by participating in the reserve.
