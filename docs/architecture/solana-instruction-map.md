# Solana Instruction Map

This map lists the canonical public instructions after the health-capital-markets redesign.

All current public instructions remain present in [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs). That file is the Anchor facade; implementation and account contexts live in the domain modules under `programs/omegax_protocol/src/`.

## Governance and Controls

| Instruction | Primary purpose |
| --- | --- |
| `initialize_protocol_governance` | bootstrap protocol governance state |
| `set_protocol_emergency_pause` | protocol-wide emergency control |
| `create_reserve_domain` | create a hard settlement or legal segregation boundary |
| `update_reserve_domain_controls` | update domain-scoped controls |
| `create_domain_asset_vault` | create custody and ledger state for a domain/mint pair |
| `update_health_plan_controls` | update plan-scoped pause and control flags |
| `update_capital_class_controls` | update class-scoped redemption and activity flags |
| `update_allocation_caps` | change allocation caps, weights, or deallocation-only mode |

## Oracle Registry and Pool Binding

| Instruction | Primary purpose |
| --- | --- |
| `register_oracle` | register a first-class oracle operator profile |
| `claim_oracle` | let the operator wallet claim and control its own profile |
| `update_oracle_profile` | update the canonical oracle profile metadata and supported schema set |
| `set_pool_oracle` | approve or deactivate an oracle for a specific liquidity pool |
| `set_pool_oracle_permissions` | set pool-scoped oracle permission bits |
| `set_pool_oracle_policy` | configure quorum, schema-verification, fee, and challenge posture for a pool |

## Schema Registry

| Instruction | Primary purpose |
| --- | --- |
| `register_outcome_schema` | register a versioned outcome schema and initialize its dependency ledger |
| `verify_outcome_schema` | mark a schema as verified or unverified through governance authority |
| `backfill_schema_dependency_ledger` | refresh the schema dependency ledger with the current pool-rule references |
| `close_outcome_schema` | retire a schema and close its dependency ledger through governance authority |

## Plan and Product Surface

| Instruction | Primary purpose |
| --- | --- |
| `create_health_plan` | create the sponsor/member/liability root |
| `create_policy_series` | create a versioned product lane under a plan |
| `version_policy_series` | create a new series version instead of mutating live economics |
| `open_member_position` | create a member participation record |
| `update_member_eligibility` | update member eligibility state and delegated rights |

## Funding, Claims, and Obligations

| Instruction | Primary purpose |
| --- | --- |
| `open_funding_line` | create a sponsor, premium, LP, backstop, or subsidy funding line |
| `fund_sponsor_budget` | transfer sponsor budget tokens into the configured domain vault and record reserve funding |
| `record_premium_payment` | transfer premium tokens into the configured domain vault and record premium income in the reserve kernel |
| `create_commitment_campaign` | create a Founder-style pre-activation commitment campaign for direct premium or treasury-credit mode |
| `deposit_commitment` | transfer committed tokens into the existing domain asset vault without increasing claims-paying reserve ledgers |
| `activate_direct_premium_commitment` | move a same-mint pending commitment into premium reserve accounting |
| `activate_treasury_credit_commitment` | lock already posted stable capacity for an OMEGAX treasury-credit commitment without selling, pricing, or counting OMEGAX as stable reserve |
| `refund_commitment` | refund a still-pending commitment in the same token amount originally deposited |
| `pause_commitment_campaign` | pause, cancel, close, or reactivate a campaign through plan/governance control |
| `create_obligation` | create a canonical liability unit |
| `reserve_obligation` | reserve liability against plan-side capital and optionally mirror a linked `ClaimCase` reserve balance |
| `settle_obligation` | move an obligation into claimable, payable, settled, or canceled states and mirror linked protection-claim settlement state |
| `release_reserve` | release reserved liability back to free capital and mirror linked protection-claim reserve state |
| `open_claim_case` | open an explicit claim lifecycle from the enrolled member wallet or a plan claim/operator path |
| `attach_claim_evidence_ref` | attach evidence and decision-support references |
| `attest_claim_case` | anchor a schema-bound oracle attestation against a live claim case |
| `adjudicate_claim_case` | approve or deny a claim case and optionally bind it to the matching `Obligation` |
| `settle_claim_case` | settle approved claim payouts through the reserve kernel only when no linked `Obligation` exists |
| `mark_impairment` | record impairment against the affected ledgers and optional obligation |

## Capital Surface

| Instruction | Primary purpose |
| --- | --- |
| `create_liquidity_pool` | create an LP-facing capital sleeve inside a reserve domain |
| `create_capital_class` | create a class-specific investor instrument inside a pool |
| `update_lp_position_credentialing` | grant or revoke managed LP access for restricted classes |
| `deposit_into_capital_class` | transfer LP capital into the configured domain vault and mint or expand class exposure using on-chain LP credential state |
| `request_redemption` | queue a class redemption request with NAV-derived asset accounting |
| `process_redemption_queue` | settle queued redemptions using queued share/NAV accounting when curator or governance allows |
| `create_allocation_position` | bridge a capital class into a plan funding line |
| `allocate_capital` | allocate class capital into a funding line |
| `deallocate_capital` | release unneeded allocated capital back to the pool |

## Planned Reserve Productivity Surface

These instructions are not part of the live IDL yet. They are the planned
surface from
[`ADR 0002`](../adr/0002-reserve-productivity-and-strategy-adapters.md) for
making reserve productive without turning the claims kernel into a general DeFi
router.

| Planned instruction | Primary purpose |
| --- | --- |
| `register_yield_strategy` | governance-register a strategy profile for one reserve domain, asset mint, adapter program, and exposure policy |
| `update_yield_strategy_controls` | update strategy caps, pause flags, active status, and policy hashes |
| `open_strategy_position` | bind one attributable reserve scope to one registered strategy |
| `deploy_free_reserve` | move only eligible free reserve into a registered adapter while booking restricted capacity |
| `harvest_strategy_yield` | reconcile realized, same-mint yield back into the domain vault and scoped ledgers |
| `recall_strategy_principal` | pull principal back from a strategy and release restricted capacity only after vault reconciliation |
| `mark_strategy_impairment` | record strategy loss against the correct reserve, allocation, and capital-class waterfall |
| `release_premium_surplus` | recognize underwriting surplus only after risk windows, claim runoff, and reserve floors are satisfied |

Hard boundary: deployed principal, unrealized APY, and adapter-reported rewards
do not count as free claims-paying reserve.

## Reviewer Notes

- The retired pre-rearchitecture program-root creation flow does not exist in the live surface.
- The retired pre-rearchitecture product-typing field does not exist in the live surface.
- Sponsor budgets and LP capital no longer share one overloaded root.
- Reward and protection both reconcile through the same reserve kernel.
- For implementation review, follow the facade delegation into `governance.rs`, `reserve_custody.rs`, `plans_membership.rs`, `funding_obligations/`, `commitments.rs`, `claims.rs`, `capital/`, `fees.rs`, or `oracle_schema.rs`.
