# QEDGen Auditor Report - 2026-05-07

## Digest

- Mode: spec-aware audit with bootstrap cross-check.
- Runtime: Anchor program using the QEDGen codegen lane.
- Real findings: 0 critical, 0 high, 1 medium.
- Spec and gate gaps: 2.
- Suppressed or accepted false positives: 1.
- Silent repro count: 0. No critical or high finding survived escalation, so no Mollusk repro was written.

## Commands

- `qedgen probe --spec omegax_protocol.qedspec`: emitted `findings: []`.
- `qedgen probe --bootstrap --root .`: detected `runtime: qedgen_codegen`, 70 handlers, and emitted `findings: []`.
- `npm run qedgen:check`: passed with 190 info findings, 1 accepted warning, 0 errors.
- `qedgen check --spec omegax_protocol.qedspec --anchor-project programs/omegax_protocol --coverage --json`: exited nonzero with handler coverage drift and a write-only `active` state warning.
- `npm run qedgen:reconcile`: reported no Rust drift and no orphan proofs; 82 Lean proof obligations remain user-owned.

## [MEDIUM] Deactivation Flags Do Not Stop New Intake Or Deposits

Status: real vulnerability, structural. Medium severity; no critical/high repro required.

### Affected Code

- `programs/omegax_protocol/src/plans_membership.rs:77-93` writes `health_plan.active = args.active` in `update_health_plan_controls`.
- `programs/omegax_protocol/src/plans_membership.rs:257-324` opens a new member position while checking protocol emergency pause and `PAUSE_FLAG_PLAN_OPERATIONS`, but not `health_plan.active`.
- `programs/omegax_protocol/src/claims.rs:979-1014` binds a claim to an eligible active member and open funding line, but has no account constraint or handler guard for `health_plan.active`.
- `programs/omegax_protocol/src/capital/classes.rs:67-94` writes `capital_class.active = args.active` in `update_capital_class_controls`.
- `programs/omegax_protocol/src/capital/lp_positions.rs:37-96` accepts a new LP deposit while checking protocol pause, positive amount, subscription pause flag, and class access mode, but not `capital_class.active`.
- `omegax_protocol.qedspec:1553-1570` models the capital-class `active` write, while `omegax_protocol.qedspec:1595-1624` models `deposit_into_capital_class` without an `active` precondition.

### Attack Shape

An operator or curator can deactivate a health plan or capital class by setting `active = false`, but that state is not enforced on several fresh-intake paths. A caller can craft transactions directly against the program to:

- open a member position for an inactive health plan if the specific plan pause flag is not also set,
- open a claim case under an inactive health plan if membership and funding-line constraints still pass,
- deposit SPL assets into an inactive capital class if subscriptions are not separately pause-flagged.

This is not a direct vault-drain path: token movement after deposit and claim settlement still depends on the existing custody, operator, and governance controls. The standalone impact is lifecycle-control bypass: deactivation does not mean "stop new intake" unless the operator also remembers the right pause flag. That is especially risky during shutdown, product sunsetting, incident response, or a public UI that hides inactive plans/classes and assumes the chain enforces the same state.

### Compose-With

- Frontend-only filtering: if inactive plans/classes disappear from the console but the program allows direct transactions, crafted transactions bypass the UX state.
- Spec under-modeling: the current spec does not require `active == true` on intake/deposit paths, so this lifecycle drift can keep passing the formal gate.
- Incident response: a fast operator deactivation can leave intake open if the corresponding pause flag is missed or delayed.

### Recommended Fix

- Add a narrow on-chain helper for health-plan intake, for example `require_health_plan_active(&HealthPlan) -> Result<()>`, and call it from new user/intake handlers such as `open_member_position`, `open_claim_case`, and any plan-scoped creation path where inactive means closed to new business.
- Add a narrow on-chain helper for capital subscriptions, for example `require_capital_class_active(&CapitalClass) -> Result<()>`, and call it before `transfer_to_domain_vault` in `deposit_into_capital_class`.
- Decide explicit wind-down semantics for redemptions. It may be correct to allow redemptions while a class is inactive, but deposits should not share that behavior accidentally.
- Update `omegax_protocol.qedspec` with scoped `active` fields and `requires active == true` guards on the same intake/subscription handlers.

## Spec Gap: Governance Handoff Handlers Are Missing From The Spec

Status: verification-gate gap.

The raw QEDGen coverage check reports two exported program instructions that are not modeled:

- `accept_protocol_governance_authority`
- `cancel_protocol_governance_authority_transfer`

The handlers are exported in `programs/omegax_protocol/src/lib.rs:104-114` and implemented in `programs/omegax_protocol/src/governance.rs:102-132`. Because they are absent from `omegax_protocol.qedspec`, the two-step governance handoff path is outside the current formal handler coverage.

The repo wrapper currently parses JSON docs into findings only when a doc has both `rule` and `severity`. Handler coverage docs do not have that shape, so `scripts/run_qedgen.mjs:197-232` can return success even when the underlying `qedgen check` process exits nonzero with `ProgramInstructionNotInSpec`.

Recommended fix:

- Add spec handlers for accept and cancel governance authority transfer.
- Make `scripts/run_qedgen.mjs` fail on `handler_coverage.kind == "ProgramInstructionNotInSpec"` and on any nonzero checker status that is not explicitly accepted.

## Spec Gap: Health-Plan Control Updates Are Under-Modeled

Status: spec gap that hid the medium lifecycle issue above.

`update_health_plan_controls` writes sponsor, claims, oracle, membership gate, rail, baseline, pause, active, and audit fields in code. The spec currently models only `audit_nonce +=! 1` at `omegax_protocol.qedspec:724-736`. That means QEDGen cannot reason about whether `health_plan.active`, plan pause flags, or membership controls are enforced by later handlers.

Recommended fix:

- Expand `update_health_plan_controls` effects to model the fields written by the Rust handler.
- Add properties tying deactivation and pause controls to new intake, claim intake, policy-series creation, and funding-line creation.

## Accepted False Positive

`missing_cpi_for_token_context:create_domain_asset_vault` remains accepted. The handler passes `token_program` for Anchor token-account initialization of the domain asset vault; it does not transfer SPL tokens in the handler body. This is already documented in `.qed/plan/findings/001-domain-vault-init-token-program.md`.

## Corpus Coverage Notes

The audit also checked the exploit corpus shapes most likely to matter here:

- no `ctx.remaining_accounts` use in the program source,
- no raw arbitrary CPI or caller-supplied program invocation path,
- no `UncheckedAccount` in the program source,
- no `init_if_needed`,
- no `unsafe`,
- no non-canonical PDA bump pattern found in the searched surfaces,
- no new unauthenticated token-outflow or attacker-recipient claim-settlement path identified.

The remaining security pressure is mostly lifecycle, spec coverage, and off-chain/operator workflow alignment rather than an obvious Solana primitive drain.
