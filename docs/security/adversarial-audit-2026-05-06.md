# Adversarial Protocol Audit - 2026-05-06

## 1. Verdict

Current posture after this pass: no unauthenticated or attacker-recipient money-out path was found in the patched tree. The fastest real money-loss path before this pass was scoped authority/account confusion around allocator-controlled surfaces; that has been closed for `update_allocation_caps` and hardened for optional reserve/allocation accounts.

What still gets exploited first is not a raw vault drain; it is privileged-control failure: compromised governance/curator/operator keys, a mistaken governance rotation, a bad bootstrap authority split, or a launch environment that does not match the evidence packet.

What destroys trust fastest is a public commitment/reserve story that implies pending or haircut-adjusted assets are active claims-paying reserve. The code and docs are now much tighter about same-asset waterfall rails and pending-vs-active reserve, but launch copy and operator dashboards must keep that separation visible.

What is probably fine now because current code and tests prove it: classic-SPL-only custody, fee-recipient binding, claim-recipient binding, selected-asset payout value bounds, direct claim settlement rejecting allocation scope, LP allocation settlement using allocation capacity rather than pretending it is funded custody, frontend pre-sign review coverage, generated IDL/contract parity, and localnet adversarial money/control probes.

## 2. Scope And Assumptions

- Date: 2026-05-06.
- Branch: `main`.
- Source snapshot audited: local commits through `d741604` plus the clean working tree at report write time.
- In scope: `programs/omegax_protocol/`, `frontend/lib/protocol.ts`, generated IDL/contract artifacts, localnet/e2e matrices, public security docs, release-gate docs, bootstrap scripts, QEDGen and Certora local lanes.
- Read-only/out of scope: mainnet sends, production funding, private key material, external private services, and live devnet mutation beyond the simulate-only operator command.
- Assumption: governance and high-value roles are intended to be multisig-backed before real-money launch. If raw keypairs are used for mainnet, severity on privileged-role findings increases.

## 3. Attack Surface Map

| Surface | Entrypoints | Assets | Trust Boundary | Existing Controls | Notes |
| --- | --- | --- | --- | --- | --- |
| Governance | `initialize_protocol_governance`, `rotate_protocol_governance_authority`, pause | Entire protocol control plane | Upgrade authority, governance signer, release operator | Init now requires ProgramData upgrade authority; pause guard; DCO docs | Rotation is still one-step. |
| Reserve custody | domain vault setup, SPL inflow/outflow helpers | SPL token custody and accounting sheets | Token program, vault PDA, mint, recipient | Classic SPL guard, PDA-signed outflows, vault/mint checks | No Token-2022 acceptance found. |
| Claims | claim intake, evidence, attestation, settlement | Approved claim value and member payout | Member, operator, oracle, funding line, settlement recipient | Claimant binding, recipient lock, evidence lock, payout rail pricing | Direct claim settlement rejects LP allocation accounts. |
| Obligations | reserve, release, settle, cancel | Reserved/payable/claimable obligations | Plan authority, claim operator, optional scoped accounts | Full-transition guards, outflow-required settlement, canonical optional PDA hardening | Linked claims require claim/member context. |
| Capital and LP | deposits, allocation caps, redemption queue, impairments | LP capital, NAV, allocation ledgers | Pool curator/allocator, LP owner, queue processor | Pool binding for allocation-cap updates, canonical ledgers, LP recipient pinning | Redemption ordering remains curator-mediated. |
| Founder commitments | campaign, payment rails, deposits, activation, refunds | Pending commitment custody and active reserve capacity | Depositor, activation authority, reserve rails | Pending not counted as reserve; same-asset waterfall docs/builders; refund only to depositor | Campaign cap semantics should stay explicit per rail vs aggregate. |
| Frontend builders | `frontend/lib/protocol.ts` | Serialized tx accounts and user signing intent | Wallet adapter and generated contract | 26/26 pre-sign review callsites covered; generated contract parity | Governance init builders now include program/programdata accounts. |
| Release chain | IDL, generated contract, public gate, localnet matrix | Public protocol surface integrity | Maintainers, CI, local toolchain | `verify:public`, localnet e2e, QEDGen, Certora prereq checks | Devnet operator sim blocked by local signer mismatch in this environment. |
| Formal lanes | QEDGen, Certora Solana | Regression evidence | Local specs vs actual handler behavior | QEDGen accepted warning only; Certora prereqs pass | Certora rules are constrained scalar/kernel models, not full handler proofs. |

## 4. Attack Story Cards

### Story: Cross-Pool Allocator Mutates Another Pool

- Attacker: allocator or curator for Pool A.
- Moment: two LP pools are live and one pool has a distressed allocation.
- Target asset: allocation cap and pause state for Pool B.
- Business pressure: operator wants a quick cap update during launch pressure.
- Technical path: pass Pool A as the authority scope but an `AllocationPosition` from Pool B into `update_allocation_caps`.
- What the victim sees: Pool B caps change even though Pool B did not authorize the action.
- Existing tripwires: `require_allocator` on the supplied pool.
- Why controls failed before this pass: the allocation position was not first bound to the supplied pool.
- Safe drill: regression test `CSO-2026-05-06` checks pool binding before authorization and mutation.

### Story: Fake Or Noncanonical Scoped Ledger

- Attacker: compromised or malicious program-owned account path, stale test fixture, or future migration bug.
- Moment: optional series/pool/allocation accounts are supplied to reserve, settlement, impairment, or claim paths.
- Target asset: reserve ledgers and allocation accounting.
- Technical path: provide an account whose inner fields look correct but whose address is not the canonical PDA for those fields.
- What the ledger should show: only canonical `SeriesReserveLedger`, `PoolClassLedger`, `AllocationPosition`, and `AllocationLedger` can mutate.
- Existing tripwires: field equality checks.
- Hardening added: validators now recompute PDA addresses and bumps before accepting optional accounts.

### Story: Bootstrap Governance Is Not Upgrade Authority

- Attacker: deploy/upgrade operator mistake or compromised initializer.
- Moment: first governance initialization after deploy.
- Target asset: governance account with authority not tied to program upgrade control.
- Technical path: initialize governance with a signer that is not the current ProgramData upgrade authority.
- Impact: upgrade authority and governance authority diverge at genesis, making incident response and release evidence false.
- Fix added: `InitializeProtocolGovernance` now requires the supplied program account and ProgramData account, and requires `program_data.upgrade_authority_address == governance_authority`.

### Story: Wallet Review Is Skipped Under Pressure

- Attacker: compromised frontend dependency, malicious operator UI, or phishing clone.
- Moment: high-value operator signs a transaction quickly.
- Target asset: any money/control instruction.
- Technical path: call a mounted transaction path without a simulation/review confirmation.
- Existing tripwires: `executeProtocolTransaction` refuses default sends without `confirmReview`, except explicit `skipReview`.
- Current result: pre-sign review coverage test found 26/26 mounted callsites covered.

### Story: Redemption Queue Favoritism

- Attacker: compromised or biased pool curator.
- Moment: LP redemption pressure during impaired reserve conditions.
- Target asset: LP liquidity timing and fairness.
- Technical path: process friendly LP redemptions first or stall unfriendly LPs.
- Existing controls: payout recipient is pinned to the LP owner and fee accounting is bounded.
- Remaining gap: no on-chain FIFO, queue index, or minimum delay enforcement. This is not a direct recipient diversion bug, but it is still a fairness and trust risk.

## 5. Confirmed Findings

### [High, Fixed] Allocation Cap Updates Were Authorized Against The Wrong Pool

- Confidence: high.
- Attack goal: mutate allocation caps for a pool the caller does not control.
- Impacted asset: LP allocation capacity, allocation freeze/active state, and operator control trust.
- Preconditions: caller controls or curates one liquidity pool but not the target allocation pool.
- Concrete path: `update_allocation_caps` called `require_allocator(authority, governance, liquidity_pool)` without first requiring `allocation_position.liquidity_pool == liquidity_pool.key()`.
- Violated invariant: every scoped mutation must bind the mutable account to the exact authority scope before authorization.
- Evidence: `programs/omegax_protocol/src/capital/allocations.rs` now has the pool equality check before `require_allocator`.
- Fix: add `require_keys_eq!(allocation_position.liquidity_pool, liquidity_pool.key(), LiquidityPoolMismatch)`.
- Regression test: `tests/security/cybersecurity_plan_regression.test.ts` `CSO-2026-05-06`.

### [Medium, Fixed/Hardening] Optional Reserve And Allocation Accounts Did Not Prove Canonical PDA Addresses

- Confidence: medium for hardening, lower for direct exploitability because Anchor account ownership already limits fake program accounts.
- Attack goal: mutate reserve/allocation accounting through a noncanonical account that matches inner fields.
- Impacted asset: series, pool class, allocation position, and allocation ledger accounting.
- Preconditions: a noncanonical program-owned account of the correct type exists through a future migration/init bug or account-state corruption.
- Concrete path: optional validators checked stored fields but not the derived PDA address/bump.
- Violated invariant: optional money-account inputs must be canonical PDAs, not just program-owned accounts with matching fields.
- Evidence: `programs/omegax_protocol/src/kernel/bindings.rs` now recomputes `SEED_SERIES_RESERVE_LEDGER`, `SEED_POOL_CLASS_LEDGER`, `SEED_ALLOCATION_POSITION`, and `SEED_ALLOCATION_LEDGER`.
- Regression test: `tests/security/allocation_scope_required_regression.test.ts` `CSO-2026-05-06`.

### [High, Fixed] Protocol Governance Initialization Did Not Prove Upgrade-Authority Control

- Confidence: high.
- Attack goal: initialize governance under a signer that is not the program upgrade authority.
- Impacted asset: release control, upgrade response, incident recovery.
- Preconditions: governance is being initialized on a freshly deployed or redeployed program.
- Concrete path: previous initializer accepted only `governance_authority`, `protocol_governance`, and `system_program`.
- Violated invariant: genesis governance must match the authority that can upgrade the program at that moment.
- Evidence: `InitializeProtocolGovernance` now includes `program` and `program_data` accounts and checks ProgramData upgrade authority.
- Fix: frontend and bootstrap builders now include `getProgramId()` and `deriveProgramDataAddress()`.
- Regression test: `tests/security/settlement_fee_guards_regression.test.ts` `ALAMANX-509b8643`.

### [Medium, Open] Governance Rotation Is Still One-Step

- Confidence: high.
- Attack goal: brick or silently transfer governance by rotating to a wrong/dead key.
- Impacted asset: protocol governance authority.
- Preconditions: current governance authority signs a mistaken or compromised rotation.
- Concrete path: `rotate_protocol_governance_authority_state` immediately writes `governance.governance_authority = new_governance_authority`; only zero pubkey is rejected.
- Violated invariant: high-value ownership transfer should require proposal plus acceptance by the new authority.
- Evidence: `programs/omegax_protocol/src/kernel/auth.rs` and historical `docs/security/codex-challenge-2026-04-29.md`.
- Existing controls: operational multisig requirement in `docs/security/mainnet-privileged-role-controls.md`.
- Why controls are not enough: multisig reduces compromise risk but does not prove the target authority can accept or recover.
- Fix: add pending authority, accept, cancel, and optional timeout semantics before mainnet funding.
- Regression test needed: rotation proposal cannot activate until the new authority signs acceptance.

### [Low/Medium, Open] Redemption Processing Is Curator-Mediated Without FIFO

- Confidence: high.
- Attack goal: reorder, delay, or selectively process LP redemptions.
- Impacted asset: LP fairness and liquidity timing.
- Preconditions: pool curator/governance controls `process_redemption_queue`.
- Concrete path: the handler processes a supplied LP position and share amount; it enforces owner recipient and fee bounds but not queue order or age.
- Violated invariant: if marketed as a fair queue, processing order must be enforceable.
- Existing controls: recipient cannot be redirected; amount is derived from pending assets/shares.
- Fix: either encode queue sequence/age and enforce FIFO, or clearly label the queue as curator-mediated in public LP terms.

## 6. Strong Hypotheses And Test Gaps

| Hypothesis | Why It Matters | Current Evidence | Probe Needed | Priority |
| --- | --- | --- | --- | --- |
| Founder campaign cap semantics may be per-rail rather than aggregate | A multi-asset campaign could accept more total nominal deposits than a reader expects from `campaign.hard_cap_amount` | `deposit_commitment` checks `payment_rail.hard_cap_amount` against the per-rail ledger; docs now describe per-asset rails | Decide product meaning and add an explicit aggregate-cap or per-rail-cap test/docs label | P2 |
| Certora lane is useful but not a full handler proof | Prevents overstating formal verification in investor/release material | Docs now say constrained scalar/kernel models only | Add deeper handler-level models when Solana prover support is deterministic enough | P3 |
| Devnet operator drawer sign-off depends on local signer parity | Simulate-only gate cannot run if local env points to the wrong governance key | Command failed before simulation due signer/config mismatch | Run with the canonical devnet governance signer or update devnet fixture env | P2 |
| One-step governance rotation may be acceptable only if governance is a mature multisig | The remaining open control-plane issue changes severity by custody setup | Mainnet docs require Squads/equivalent multisig | Prove Squads V4 2-of-3 and record no-send mainnet plan in RC evidence | P1 before funding |

## 7. Hard Invariants

1. Pending commitments never count as claims-paying reserve.
2. Waterfall reserve activation books haircut-adjusted capacity, not the full token liability.
3. Pending custody, treasury inventory, reserve capacity, and active cover are separate states.
4. Every allocator/curator mutation binds the mutable account to the supplied pool before authorization.
5. Every optional reserve/allocation money account is the canonical PDA for its seeds and bump.
6. Governance initialization proves the initializer is the current program upgrade authority.
7. Governance rotation cannot target the zero pubkey.
8. Before mainnet funding, governance rotation should require target acceptance.
9. Claim intake by an operator cannot override the member-position claimant.
10. Claim recipient changes lock after approval, payout, or terminal state.
11. Evidence references lock after the first attestation.
12. Direct claim settlement cannot include LP allocation scoped accounts.
13. Linked obligation settlement requires linked claim and member context.
14. Asset-backed settlement always includes SPL outflow accounts.
15. Settlement recipients must match the member/delegate for linked claims.
16. Unlinked obligation settlements must pay a token account owned by the settling authority.
17. Fee withdrawals pay only configured fee recipients.
18. Fee withdrawals cannot exceed accrued minus withdrawn fees.
19. Zero-net fee outcomes are rejected.
20. Token-2022 mints/programs are rejected for v1 custody.
21. Selected-asset payouts require payout-enabled rails with fresh nonzero-staleness pricing.
22. Selected-asset payout value cannot exceed configured overpay bounds.
23. LP redemption pays only the LP owner.
24. Redemption assets are derived from queued shares/assets, not caller-supplied value.
25. Redemption processing cannot create zero-net LP payouts.
26. Allocation settlement debits allocation ledgers as allocation capacity, not funded custody.
27. Impairments on LP-allocation funding lines require scoped accounts.
28. Frontend mounted wallet sends require pre-sign review or explicit `skipReview`.
29. Generated IDL, `shared/protocol_contract.json`, and frontend generated contract files match program source.
30. Localnet adversarial matrix owns every live instruction in the surface manifest.
31. Mainnet bootstrap must require distinct operational role wallets unless break-glass is explicitly documented.
32. Public docs must not claim Certora or third-party audit coverage unless that review exists.

## 8. Validation

Passed:

- `npm run verify:public`
  - Rust fmt, Rust unit tests: 84 passed, Rust clippy.
  - IDL freshness and protocol contract parity.
  - Node tests: 254 passed.
  - Frontend production build.
  - Semantic readiness, public hygiene, license audit, dependency advisory audit, SBOM generation.
- `npm run test:e2e:localnet`
  - 19 passed.
  - Executable adversarial matrix: `62 blocked`, `0 unexpectedSuccess`, `0 inconclusive`.
  - Commitment custody drill: 3 assets, 100 users per asset, 300 refunds, 27 blocked probes, 9 activation-mode checks.
- `npm run qedgen:check`
  - `190 info`, `1 warnings`, `0 errors`.
  - Accepted warning: `missing_cpi_for_token_context` on `create_domain_asset_vault`.
- `npm run certora:solana:check`
  - Local prerequisites pass; no remote job submitted.
- Focused tests:
  - `tests/security/cybersecurity_plan_regression.test.ts`
  - `tests/security/allocation_scope_required_regression.test.ts`
  - `tests/security/pre_sign_review_coverage.test.ts`
  - `tests/security/settlement_fee_guards_regression.test.ts`
  - `tests/protocol_contract.test.ts`

Failed / environment-blocked:

- `npm run devnet:operator:drawer:sim`
  - Failed before simulation because the local signer did not match the configured devnet governance wallet. No send path executed.

Repository state at report time:

- Working tree clean.
- Local `main` is ahead of `origin/main` by 5 commits.
- No push was performed in this audit run.

## 9. Recommended Next Moves

1. Do not mainnet-fund from this state until Squads/equivalent governance and upgrade posture are proven in release-candidate evidence.
2. Replace one-step governance rotation with propose/accept/cancel before real-money launch, or formally accept the risk in the production control packet.
3. Decide and document Founder campaign cap semantics: explicitly per-rail or aggregate campaign cap.
4. Re-run `npm run devnet:operator:drawer:sim` with the canonical devnet governance signer and record the result.
5. If this becomes a release candidate, push only after deciding whether the five local commits should all land on `main` now, because pushing will trigger the public repo workflow.
