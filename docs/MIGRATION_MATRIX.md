# Migration Matrix

This matrix records the hard-break migration from the legacy pool-centric devnet surface to the canonical OmegaX health capital markets model.

## Root nouns

| Old noun | New noun | Notes |
| --- | --- | --- |
| `Pool` | `HealthPlan` or `LiquidityPool` | Split by actual meaning. A sponsor program is a `HealthPlan`. LP capital sleeve is a `LiquidityPool`. |
| `pool_type` | removed | Product semantics now live on `PolicySeries.mode`. Capital semantics live on `LiquidityPool` and `CapitalClass`. |
| `PoolTerms` | `HealthPlan` + `PolicySeries` | Sponsor/member metadata stays on the plan. Live economics move to immutable series versions. |
| `MembershipRecord` | `MemberPosition` | Member rights are scoped to plan and optional series, not to an overloaded pool root. |
| `PolicyPosition` | `MemberPosition` | Policy participation is represented directly as a member position in a series. |
| `CoverageClaimRecord` | `ClaimCase` + `Obligation` | Claim workflow and economic liability are separated but linked. |
| reward claim accounts | `Obligation` | Fast reward flows book canonical liabilities too. |
| `PoolTreasuryReserve` | `DomainAssetLedger`, `PlanReserveLedger`, `SeriesReserveLedger`, `FundingLineLedger`, `PoolClassLedger`, `AllocationLedger` | One reserve kernel, many scoped ledgers. |
| `PoolLiquidityConfig` | `LiquidityPool` | LP-facing capital sleeve. |
| `PoolCapitalClass` | `CapitalClass` | Same core concept, but no longer hanging off a sponsor program root. |
| redemption request state | `LPPosition` + queue fields on `CapitalClass` | Queue semantics are class-level investor mechanics, not plan semantics. |
| partial pool risk config | scoped pause flags across `ReserveDomain`, `HealthPlan`, `LiquidityPool`, `CapitalClass`, `AllocationPosition` | Safety controls become explicit and scoped. |

## Funding and accounting

| Old behavior | New behavior | Why |
| --- | --- | --- |
| sponsor funding lands in a pool treasury | sponsor funding lands in `FundingLine` of type `SponsorBudget` | Sponsor expense capital is not LP capital. |
| premium logic tied to series but treasury truth tied to pool | premiums flow into `FundingLine` and reserve ledgers | Funding source attribution becomes explicit. |
| LP deposits can look like generic pool funding | LP deposits mint `LPPosition` inside a `CapitalClass` | Capital rights stay explicit. |
| reserve truth summarized mostly at pool level | reserve truth lives at domain, plan, series, funding line, class, and allocation scopes | Shared reserve without accounting fog. |
| claim reserves tracked separately from reward reserves | both create `Obligation` state | One shared settlement foundation. |

## Instructions

| Legacy instruction family | Canonical replacement |
| --- | --- |
| `create_pool` | `create_health_plan` and, where capital is needed, `create_liquidity_pool` |
| `set_pool_status` | `update_health_plan_controls` or scoped pause flows |
| `fund_pool_*` | `fund_sponsor_budget` or `deposit_into_capital_class` |
| `initialize_pool_liquidity_*` | `create_liquidity_pool` and `create_capital_class` |
| `register_pool_capital_class` | `create_capital_class` |
| `deposit_pool_liquidity_*` | `deposit_into_capital_class` |
| `request_pool_liquidity_redemption` and queue handlers | `request_redemption` and `process_redemption_queue` |
| `create_policy_series` / `update_policy_series` | `create_policy_series` / `version_policy_series` |
| reward-claim settlement | `create_obligation`, `reserve_obligation`, `settle_obligation` |
| coverage claim review + payout | `open_claim_case`, `attach_claim_evidence_ref`, `adjudicate_claim_case`, `settle_claim_case` |
| pool treasury impairment/risk toggles | `mark_impairment`, `set_scoped_pause`, `clear_scoped_pause` |

## Frontend and product naming

| Old UI noun | New UI noun |
| --- | --- |
| sponsor pool | health plan |
| reward pool | sponsor-funded health plan with a reward series |
| coverage pool | health plan with a protection or reimbursement series |
| liquidity pool funding plan | liquidity pool allocation into a funding line |
| pool treasury | reserve ledger / domain asset vault |

## Devnet fixture mapping

| Legacy fixture | New fixture |
| --- | --- |
| default pool | default open reserve domain + sponsor-funded Seeker health plan |
| rewards series | Seeker reward `PolicySeries` |
| coverage series | mixed-plan protection `PolicySeries` |
| pool authority wallet | plan admin or pool curator depending on flow |
| risk manager wallet | sentinel or adjudicator depending on flow |
| capital provider wallet | LP owner for a capital class |
| claim case fixture | `ClaimCase` plus linked `Obligation` fixture |

## Retired anti-patterns

- `pool_type`
- hybrid pool logic
- sponsor budget treated like LP principal
- reserve truth hidden in one treasury aggregate
- capital class semantics attached to sponsor program identity
- silent economic mutation of live product lanes
