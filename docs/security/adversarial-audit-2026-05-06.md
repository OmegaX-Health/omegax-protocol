# Adversarial Protocol Audit - 2026-05-06

## 1. Verdict

Current posture after this implementation pass: no unauthenticated or attacker-recipient money-out path was found in the patched tree. The fastest real money-loss path before the earlier pass was scoped authority/account confusion around allocator-controlled surfaces; that remains closed for `update_allocation_caps` and hardened for optional reserve/allocation accounts.

The remaining exploitable edge is operational rather than a newly observed vault-drain path: compromised governance/curator/operator keys, a bad bootstrap authority split, or a launch environment that does not match the evidence packet. The trimmed protocol surface removes in-program governance authority handoff; launch environments must initialize or redeploy with the intended multisig. The devnet operator drawer simulation has been rerun with the canonical governance signer; mainnet funding still depends on proving the intended multisig.

What destroys trust fastest is a public reservation/reserve story that implies pending or haircut-adjusted assets are active claims-paying reserve. The code, docs, and UI copy now describe Founder reservations as off-chain Squads custody only; pending reservations remain separate from active cover and claims-paying reserve.

What is probably fine now because current code and tests prove it: classic-SPL-only custody, claim-recipient binding, same-asset claim payout reserve checks, direct claim settlement rejecting allocation scope, LP allocation settlement using allocation capacity rather than pretending it is funded custody, on-chain FIFO redemption processing, frontend pre-sign review coverage, generated IDL/contract parity, and localnet adversarial money/control probes.

## 2. Scope And Assumptions

- Date: 2026-05-06.
- Branch: `codex/fix-adversarial-findings-20260506`.
- Source snapshot audited: implementation branch at report write time, after generated IDL/contract refresh.
- In scope: `programs/omegax_protocol/`, `frontend/lib/protocol.ts`, generated IDL/contract artifacts, localnet/e2e matrices, public security docs, release-gate docs, bootstrap scripts, QEDGen and Certora local lanes.
- Read-only/out of scope: mainnet sends, production funding, private key material, external private services, and live devnet mutation beyond the simulate-only operator command.
- Assumption: governance and high-value roles are intended to be multisig-backed before real-money launch. If raw keypairs are used for mainnet, severity on privileged-role findings increases.

## 3. Attack Surface Map

| Surface | Entrypoints | Assets | Trust Boundary | Existing Controls | Notes |
| --- | --- | --- | --- | --- | --- |
| Governance | `initialize_protocol_governance`, pause | Entire protocol control plane | Upgrade authority, governance signer, release operator | Init requires ProgramData upgrade authority; no trimmed in-program authority handoff; pause guard; DCO docs | Deployment must initialize with the intended governance authority. |
| Reserve custody | domain vault setup, SPL inflow/outflow helpers | SPL token custody and accounting sheets | Token program, vault PDA, mint, recipient | Classic SPL guard, PDA-signed outflows, vault/mint checks | No Token-2022 acceptance found. |
| Claims | claim intake, evidence, attestation, settlement | Approved claim value and member payout | Member, operator, oracle, funding line, settlement recipient | Claimant binding, recipient lock, evidence lock, payout rail pricing | Direct claim settlement rejects LP allocation accounts. |
| Obligations | reserve, release, settle, cancel | Reserved/payable/claimable obligations | Plan authority, claim operator, optional scoped accounts | Full-transition guards, outflow-required settlement, canonical optional PDA hardening | Linked claims require claim/member context. |
| Capital and LP | deposits, allocation caps, redemption queue, impairments | LP capital, NAV, allocation ledgers | Pool curator/allocator, LP owner, queue processor | Pool binding for allocation-cap updates, canonical ledgers, LP recipient pinning, FIFO sequence enforcement | Partial processing does not advance the queue head. |
| Founder reservations | website/oracle-service reservation records | Off-chain Squads custody before activation | Buyer wallet, Squads operators, reservation service | Pending reservations do not count as reserve and require later activation/posting through normal reserve controls | The retired on-chain Founder commitment surface is no longer part of the active protocol program. |
| Frontend builders | `frontend/lib/protocol.ts` | Serialized tx accounts and user signing intent | Wallet adapter and generated contract | 26/26 pre-sign review callsites covered; generated contract parity | Governance init builders now include program/programdata accounts. |
| Release chain | IDL, generated contract, public gate, localnet matrix | Public protocol surface integrity | Maintainers, CI, local toolchain | `verify:public`, localnet e2e, QEDGen, Certora prereq checks, devnet operator drawer simulation | No mainnet send path was executed. |
| Formal lanes | QEDGen, Certora Solana | Regression evidence | Local specs vs actual handler behavior | QEDGen passes with one accepted warning; Certora local prerequisites pass | Certora check submits no remote job. |

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
- What the ledger should show: current sponsor-reserve accounting mutates only canonical domain, plan, and funding-line ledgers.
- Existing tripwires: field equality checks and PDA seed constraints on live ledger accounts.
- Hardening added: the former optional scoped-ledger paths were removed from the live base protocol surface.

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
- Fix added: each first pending redemption request receives a FIFO sequence; top-ups preserve the original sequence; processing must target the current queue head; partial processing leaves the queue head pinned until that LP position is fully cleared.

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

### [Medium, Retired] Optional Reserve And Allocation Accounts Did Not Prove Canonical PDA Addresses

- Confidence: medium for hardening, lower for direct exploitability because Anchor account ownership already limits fake program accounts.
- Attack goal: mutate reserve/allocation accounting through a noncanonical account that matches inner fields.
- Impacted asset: former series, pool class, allocation position, and allocation ledger accounting.
- Preconditions: a noncanonical program-owned account of the correct type exists through a future migration/init bug or account-state corruption.
- Concrete path: optional validators checked stored fields but not the derived PDA address/bump.
- Violated invariant: optional money-account inputs must be canonical PDAs, not just program-owned accounts with matching fields.
- Evidence: the live base protocol no longer accepts the optional series, pool-class, allocation-position, or allocation-ledger accounts on treasury mutation paths.
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

### [Medium, Fixed] Governance Rotation Was One-Step

- Confidence: high.
- Attack goal: brick or silently transfer governance by rotating to a wrong/dead key.
- Impacted asset: protocol governance authority.
- Preconditions: current governance authority signs a mistaken or compromised rotation.
- Concrete path before the two-step fix: `rotate_protocol_governance_authority_state` immediately wrote `governance.governance_authority = new_governance_authority`; only zero pubkey was rejected.
- Violated invariant: high-value ownership transfer should require proposal plus acceptance by the new authority.
- Current trimmed surface: the in-program authority handoff has been removed; deployments must initialize or redeploy with the intended governance authority.
- Fix: add pending authority, accept, cancel, and 7-day expiry semantics.
- Regression tests: Rust unit coverage for propose/accept/cancel/expired/missing pending authority, plus Node builder coverage for proposal, acceptance, and cancellation.

### [Low/Medium, Fixed] Redemption Processing Was Curator-Mediated Without FIFO

- Confidence: high.
- Attack goal: reorder, delay, or selectively process LP redemptions.
- Impacted asset: LP fairness and liquidity timing.
- Preconditions: pool curator/governance controls `process_redemption_queue`.
- Concrete path before this fix: the handler processed a supplied LP position and share amount; it enforced owner recipient and fee bounds but not queue order or age.
- Violated invariant: if marketed as a fair queue, processing order must be enforceable.
- Evidence: `CapitalClass` now tracks next assigned and next processable redemption sequences; `LPPosition` stores its sequence and first-request timestamp.
- Fix: first pending request assigns a sequence, pending top-ups keep that sequence, out-of-order processing is rejected, and partial processing does not advance the queue head.
- Regression tests: Rust unit coverage for sequence assignment/top-up preservation, out-of-order rejection, and partial-processing queue-head behavior.

## 6. Strong Hypotheses And Test Gaps

| Hypothesis | Why It Matters | Current Evidence | Probe Needed | Priority |
| --- | --- | --- | --- | --- |
| Certora lane is useful but not a full handler proof | Prevents overstating formal verification in investor/release material | `npm run certora:solana:check` verifies local prerequisites only and submits no remote job | Add deeper handler-level models when Solana prover support is deterministic enough | P3 |
| Mainnet funding still depends on multisig evidence | Two-step transfer reduces mistakes but does not make a raw keypair operationally safe | Mainnet docs require Squads/equivalent multisig; no mainnet send was performed in this pass | Prove Squads V4 2-of-3 and record no-send mainnet plan in RC evidence | P1 before funding |

## 7. Hard Invariants

1. Pending reservations never count as claims-paying reserve.
2. Waterfall reserve activation books haircut-adjusted capacity, not the full token liability.
3. Pending custody, treasury inventory, reserve capacity, and active cover are separate states.
4. Every allocator/curator mutation binds the mutable account to the supplied pool before authorization.
5. Every optional reserve/allocation money account is the canonical PDA for its seeds and bump.
6. Governance initialization proves the initializer is the current program upgrade authority.
7. Governance rotation cannot target the zero pubkey.
8. Governance authority transfer requires proposal, pending-authority acceptance, expiry enforcement, and current-governance cancellation.
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
21. Same-asset claim payouts require payout-enabled rails with fresh nonzero-staleness pricing.
22. Cross-asset selected payout is not exposed as a claim settlement path.
23. LP redemption pays only the LP owner.
24. LP redemption processing must target the current FIFO head sequence.
25. Partial LP redemption processing cannot advance the FIFO head before the LP position is fully cleared.
26. Redemption assets are derived from queued shares/assets, not caller-supplied value.
27. Redemption processing cannot create zero-net LP payouts.
28. Allocation settlement debits allocation ledgers as allocation capacity, not funded custody.
29. Impairments on LP-allocation funding lines require scoped accounts.
30. Frontend mounted wallet sends require pre-sign review or explicit `skipReview`.
31. Generated IDL, `shared/protocol_contract.json`, and frontend generated contract files match program source.
32. Localnet adversarial matrix owns every live instruction in the surface manifest.
33. Mainnet bootstrap must require distinct operational role wallets unless break-glass is explicitly documented.
34. Public docs must not claim Certora, QEDGen, or third-party audit coverage unless that review exists.

## 8. Validation

Passed:

- `npm run anchor:idl`
  - Regenerated `idl/omegax_protocol.json` and source hash.
- `npm run protocol:contract`
  - Regenerated `shared/protocol_contract.json` and frontend generated contract files.
  - Contract SHA: `5988efbe9e29ff7b6da5363223ed00a8085adf5278d766e03fad94f5318b940b`.
- `cargo test -p omegax_protocol --lib`
  - Rust unit tests: 89 passed.
- `npm run test:node`
  - Node tests: 256 passed.
- `npm run verify:public`
  - Rust fmt, Rust unit tests, Rust clippy.
  - IDL freshness and protocol contract parity.
  - Node tests: 256 passed.
  - Frontend production build.
  - Semantic readiness, public hygiene, license audit, dependency advisory audit, SBOM generation.
- `npm run test:e2e:localnet`
  - 19 passed.
  - Localnet surface manifest owns 70/70 live instructions.
  - Executable adversarial matrix: `68 blocked`, `0 unexpectedSuccess`, `0 inconclusive`.
  - Historical commitment custody drill retired with the on-chain Founder commitment surface.
- `npm run certora:solana:check`
  - Local prerequisites pass; no remote job submitted.
- `npm run qedgen:check`
  - `190 info`, `1 warning`, `0 errors`.
  - Accepted warning: `missing_cpi_for_token_context` on `create_domain_asset_vault` because the handler has `token_program` in accounts but no `transfers` block.
- `SOLANA_KEYPAIR=<canonical devnet governance keypair> npm run devnet:operator:drawer:sim`
  - `PASS=7`, `EXPECTED_COLLISION=4`, `BUILDER_OK=5`, `SKIP=5`, `FAIL=0`.
  - Builder health: 16/16 attempted flows reached the program cleanly.
- Focused tests:
  - Rust governance transfer and FIFO redemption unit coverage.
  - Founder reservation reserve treatment now lives in website/oracle-service tests; pending reservations never count as protocol reserve.
  - `tests/protocol_governance_builders.test.ts`
  - `tests/protocol_contract.test.ts`

Failed / environment-blocked:

- None remaining in this pass.

Repository state at report time:

- Working branch: `codex/fix-adversarial-findings-20260506`.
- No mainnet/devnet transaction send path executed in this implementation pass.
- No secrets or keypair paths were committed.

## 9. Recommended Next Moves

1. Do not mainnet-fund from this state until Squads/equivalent governance and upgrade posture are proven in release-candidate evidence.
2. If this becomes a release candidate, push only after deciding whether the existing local `main` commits bundled into this branch should land together, because pushing will trigger the public repo workflow.
