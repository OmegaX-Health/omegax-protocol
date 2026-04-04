# Solana Instruction Map

This map lists the canonical public instructions after the health-capital-markets redesign.

All current public instructions are defined in [`programs/omegax_protocol/src/lib.rs`](../../programs/omegax_protocol/src/lib.rs).

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
| `fund_sponsor_budget` | record sponsor budget funding |
| `record_premium_payment` | record premium income into the reserve kernel |
| `create_obligation` | create a canonical liability unit |
| `reserve_obligation` | reserve liability against plan-side capital |
| `settle_obligation` | move an obligation into claimable, payable, settled, or canceled states |
| `release_reserve` | release reserved liability back to free capital |
| `open_claim_case` | open an explicit claim lifecycle |
| `attach_claim_evidence_ref` | attach evidence and decision-support references |
| `adjudicate_claim_case` | approve or deny a claim case |
| `settle_claim_case` | settle approved claim payouts through the reserve kernel |
| `mark_impairment` | record impairment against the affected ledgers and optional obligation |

## Capital Surface

| Instruction | Primary purpose |
| --- | --- |
| `create_liquidity_pool` | create an LP-facing capital sleeve inside a reserve domain |
| `create_capital_class` | create a class-specific investor instrument inside a pool |
| `deposit_into_capital_class` | mint or expand LP exposure into a class |
| `request_redemption` | queue a class redemption request |
| `process_redemption_queue` | settle queued redemptions when capacity allows |
| `create_allocation_position` | bridge a capital class into a plan funding line |
| `allocate_capital` | allocate class capital into a funding line |
| `deallocate_capital` | release unneeded allocated capital back to the pool |

## Reviewer Notes

- The retired pre-rearchitecture program-root creation flow does not exist in the live surface.
- The retired pre-rearchitecture product-typing field does not exist in the live surface.
- Sponsor budgets and LP capital no longer share one overloaded root.
- Reward and protection both reconcile through the same reserve kernel.
