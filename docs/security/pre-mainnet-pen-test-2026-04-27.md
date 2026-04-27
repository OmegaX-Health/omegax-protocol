# Pre-Mainnet Penetration Test — OmegaX Protocol

**Date:** 2026-04-27  
**Reviewer:** Adversarial review pass, complementing CSO infrastructure audit ([2026-04-27](../../.superstack/security-reports/omegax-protocol-2026-04-27.md))  
**Scope:** On-chain program, frontend pre-sign review gate, oracle/operator trust boundaries, Genesis launch configuration  
**Methodology:** Static-source pen-test with PoC tests in `tests/security/`. Each finding has a runnable test that confirms or refutes the claim against the live source tree. PoCs ran via `npm run test:node` on 2026-04-27, all 18 assertions green.

---

## Executive summary

**Verdict: NOT READY FOR MAINNET.** Two CRITICAL findings block launch as-is.

The OmegaX program in `programs/omegax_protocol/` accepts SPL token deposits but has **no on-chain instruction that releases tokens back out**. Every "settle / process / release" handler updates ledger state and decrements the vault's `total_assets` counter, but **no `transfer_checked` CPI is called**. The IDL contains no `withdraw_*`, `sweep_*`, or fee-collection instruction. The frontend ships a treasury-panel UI whose imports point to nonexistent builders — `pool-treasury-panel.tsx:14-19` imports six `buildWithdraw*Tx` names from `@/lib/protocol`, none of which is exported by that file (49 builders enumerated; zero match).

Net effect: depositing any token into a Genesis Protect domain on mainnet today would **lock those tokens in the vault until a program upgrade ships outflow paths**. There is no on-chain user recovery route.

Adjacent findings (HIGH and below) prime money-diversion and metadata-spoofing risks that activate the moment outflow paths land. The single-key SPOF for Genesis launch (one keypair holding governance, sponsor, claims-operator, and oracle roles) compounds the blast radius.

The CSO 2026-04-27 audit's only HIGH finding (CSO-01: claim intake authorization) **is wired in**: `require_claim_intake_submitter` (lib.rs:5166) is called from `open_claim_case` (lib.rs:1236), and the Anchor context binds `member_position` and `funding_line` to the same `health_plan` — the cross-plan path is closed.

### Required-fixes-to-ship

| Priority | Action |
|---|---|
| **P0** | Design and implement the on-chain outflow paths (settlement payout, redemption payout, fee/treasury withdrawal). Decide upfront whether outflow signers are `claim_case.claimant` (operator-controllable today) or `member_position.wallet` (immutable). |
| **P0** | Either delete the dead `pool-treasury-panel.tsx` UI or wire it to real builders backed by real instructions. Today it appears functional in the UI but the imports do not resolve and the tsconfig (PT-13) hides the breakage. |
| **P1** | Restore typecheck coverage for `frontend/components/**` and the six excluded lib files (PT-13). The current `tsconfig.json` exclusion is the structural reason PT-03 ships unflagged. |
| **P1** | Constrain `args.claimant` in `require_claim_intake_submitter`'s operator branch (lib.rs:5174) before P0 is shipped, so operator-routed claim diversion is impossible by construction. |
| **P1** | Pre-sign review gate coverage on every `executeProtocolTransaction` callsite that mutates fees, treasury, oracle authority, claims state, or governance state. **4/33 callsites** currently pass review metadata. |
| **P1** | Split Genesis launch keys: distinct keypairs for governance / sponsor / claims-operator / oracle, OR move governance to a multisig. The default-to-governance config (`scripts/support/genesis_live_bootstrap_config.ts:287-338`) creates a single point of compromise. |
| **P2** | Add a `require_keys_eq!` between `args.oracle` and `ctx.accounts.admin.key()` in `register_oracle` (lib.rs:1989), or accept the squat-then-recover pattern with explicit documentation. |
| **P2** | Add an LP redemption settlement timestamp / NAV-snapshot guard so a sentinel-driven impairment cannot socialize losses to non-redeemers between `request_redemption` and `process_redemption_queue`. |

### CSO 2026-04-27 reconciliation

| CSO finding | Status as of 2026-04-27 |
|---|---|
| CSO-2026-04-27-01 (HIGH, claim intake authorization) | **REMEDIATED** — verified by [`tests/security/cso_01_intake_gate_regression.test.ts`](../../tests/security/cso_01_intake_gate_regression.test.ts). Three-test regression suite covers the gate, its branches, and the Anchor context constraints. |
| CSO-2026-04-27-02 (MEDIUM, CI/CD) | PARTIAL — action refs are now SHA-pinned in `.github/workflows/ci.yml`, CODEOWNERS exists. Branch protection on `main` not re-tested; out of scope here. |
| CSO-2026-04-27-03 (MEDIUM, deps) | PARTIAL — uuid override + Next.js 16.2.4 in place; `bigint-buffer` accepted-risk documented. Out of scope here. |

This pen-test surfaced 9 **new** findings not modeled by the CSO audit (PT-01..PT-08, PT-13, plus PT-12 INFO). PT-13 was added after running `npm --prefix frontend run build` revealed PT-03's structural cause.

---

## Methodology

For each candidate vulnerability:

1. **Source trace.** Reads the actual code path, recording file:line references rather than agent summaries.
2. **PoC test.** A runnable test in `tests/security/` that confirms the claim against the live source tree. Tests are written so they PASS while the vulnerability exists; when the team remediates, the tests should fail and either be deleted or flipped into defense tests.
3. **Outcome record.** Status of `VULN_CONFIRMED` (test passes today and demonstrates the claim) or `DEFENSE_HOLDS` (test passes today and demonstrates the existing defense).
4. **Remediation.** Specific code edits with line references.

PoCs run via `npm run test:node` (no localnet harness needed). Localnet PoCs were considered but skipped — every finding except PT-08 (NAV first-mover) is fully proved by the static path. PT-08 is documented with a static trace as `INCONCLUSIVE-but-evidence-strong`; if the team wants a localnet demonstration it can be added later.

### Verified during planning

| Claim | Source line | Status |
|---|---|---|
| 45 instructions in the program; no withdrawal handler | lib.rs grep, last is `attest_claim_case` at 2288 | Confirmed |
| Only token CPI in the program is `transfer_to_domain_vault` | lib.rs:5408-5459 | Confirmed |
| `settle_claim_case` is accounting-only | lib.rs:1354-1416 — no CPI in body | Confirmed |
| `process_redemption_queue` is accounting-only | lib.rs:1696-1764 — no CPI in body | Confirmed |
| `require_claim_intake_submitter` is wired in | lib.rs:1236 calls; 5166 defines | Confirmed (CSO-01 fix) |
| `member_position` is bound to `health_plan` in OpenClaimCase | lib.rs:2777 — `member_position.health_plan == health_plan.key()` | Confirmed (cross-plan blocked) |
| Frontend treasury-panel imports six dead `buildWithdraw*` names | pool-treasury-panel.tsx:14-19 vs zero matches in protocol.ts | Confirmed |

---

## Findings

### [CRITICAL] PT-2026-04-27-01: No on-chain treasury / fee withdrawal instruction

**Confidence:** 10/10  
**Class:** Design — protocol incompleteness  
**Severity:** **CRITICAL — blocks mainnet**  
**PoC:** [`tests/security/no_money_out_path.test.ts::[PT-01]`](../../tests/security/no_money_out_path.test.ts)  
**Outcome:** `VULN_CONFIRMED`

The on-chain program declares 45 instructions ending at `attest_claim_case` (lib.rs:2288). None matches `withdraw_*`, `sweep_*`, `collect_fee*`, `reclaim_*`, or `payout_*`. The IDL at `idl/omegax_protocol.json` confirms (zero "withdraw" mentions, case-insensitive).

**Exploit narrative.** This is not an exploit per se — it is **the absence of any user-facing or operator-facing path to extract funds from the vaults**. Once a member, sponsor, or LP deposits SPL tokens via `fund_sponsor_budget` (lib.rs:719), `record_premium_payment` (lib.rs:770), or `deposit_into_capital_class` (lib.rs:1573), those tokens are routed to the program-owned `domain_asset_vault` and there is no on-chain instruction signed by anyone — including governance — that releases them.

**Remediation.** Three options, in increasing complexity:

1. Document explicitly that mainnet outflows are operator-mediated via direct token-account control by `domain_asset_vault.vault_token_account`'s authority (and confirm what authority that is — likely a PDA owned by the program, in which case option 1 is impossible).
2. Ship a `withdraw_pool_treasury` / `settle_claim_payout` / `process_redemption_payout` instruction set that performs `TransferChecked` from the program-PDA-controlled vault to a recipient ATA, with appropriate authority gating.
3. Adopt option 2 plus a multisig timelock on the withdraw authority for tail risk.

**Residual risk if not fixed.** Every dollar deposited becomes inaccessible without a program upgrade. This is not a vulnerability to be patched — it is a missing protocol surface.

---

### [CRITICAL] PT-2026-04-27-02: Money-out paths are accounting-only — no SPL token CPI

**Confidence:** 10/10  
**Class:** Design — protocol incompleteness  
**Severity:** **CRITICAL — blocks mainnet**  
**PoC:** [`tests/security/no_money_out_path.test.ts::[PT-02]`](../../tests/security/no_money_out_path.test.ts) (two assertions)  
**Outcome:** `VULN_CONFIRMED`

The four handlers that the IDL describes as "settling" or "releasing" funds — `settle_claim_case` (lib.rs:1354), `process_redemption_queue` (lib.rs:1696), `settle_obligation` (lib.rs:997), `release_reserve` (lib.rs:1159) — contain **zero** token CPI calls. The PoC programmatically extracts each handler's body and asserts the absence of `token_interface::transfer`, `token::transfer`, `transfer_checked`, `invoke_signed`, and `invoke(`.

The program's only token CPI is `transfer_to_domain_vault` (lib.rs:5408). The PoC further verifies this helper is called only from the three deposit handlers (`fund_sponsor_budget`, `record_premium_payment`, `deposit_into_capital_class`) — confirming the program is **inflow-only** by construction.

**Exploit narrative.** A user deposits 100 USDC into a capital class via `deposit_into_capital_class`. The user then calls `request_redemption` and an operator calls `process_redemption_queue`. The program's state shows:

- `lp_position.shares` decremented
- `lp_position.realized_distributions` incremented
- `capital_class.nav_assets` decremented
- `liquidity_pool.total_value_locked` decremented
- `domain_asset_vault.total_assets` decremented (a u64 counter inside the vault account — **not** an SPL transfer)

The user's wallet token balance is unchanged. The vault token account's actual SPL balance is unchanged. The program has booked the redemption "as paid" but no tokens moved.

**Remediation.** Add a `TransferChecked` CPI inside each money-out handler, signed by the program PDA that owns `vault_token_account`. The vault token account is owned by `domain_asset_vault` PDA per `create_domain_asset_vault` (lib.rs:288). Outflow handlers must invoke `token::transfer_checked` with the appropriate seed-derived signer.

**Sequence considerations.**
- `process_redemption_queue` (lib.rs:1696): transfer `asset_amount` from vault to LP's token account (caller must pass `recipient_token_account: TokenAccount` whose owner is `lp_position.owner`).
- `settle_claim_case` / `settle_obligation`: transfer `amount` to either `claim_case.claimant` or `member_position.wallet` ATA. **Decide which.** See PT-04 for why this matters.
- A new `withdraw_protocol_fee` / `withdraw_pool_treasury` handler set: transfer to a governance-supplied recipient with appropriate authority gating.

---

### [HIGH] PT-2026-04-27-03: Frontend treasury-panel UI imports unresolved builders

**Confidence:** 10/10  
**Class:** Build integrity / dead UI — escapes typecheck due to PT-13  
**Severity:** **HIGH** — visible UI that fails at runtime, ships unflagged because typecheck doesn't cover it  
**PoC:** [`tests/security/treasury_panel_imports_unresolved.test.ts`](../../tests/security/treasury_panel_imports_unresolved.test.ts) (four assertions)  
**Outcome:** `VULN_CONFIRMED`

`frontend/components/pool-treasury-panel.tsx:14-19` imports six builders from `@/lib/protocol`:

```ts
buildWithdrawPoolOracleFeeSolTx
buildWithdrawPoolOracleFeeSplTx
buildWithdrawPoolTreasurySolTx
buildWithdrawPoolTreasurySplTx
buildWithdrawProtocolFeeSolTx
buildWithdrawProtocolFeeSplTx
```

`frontend/lib/protocol.ts` contains 49 `buildX*Tx` exports — none of them matches any of these six names. The IDL also has no corresponding instruction. The PoC confirms all three: the panel imports the names, the protocol.ts does not export them, and the IDL does not back them.

**Verified post-build (2026-04-27).** `npm --prefix frontend run build` exits 0. The reason is **structural** — see PT-13. The frontend's `tsconfig.json` excludes `components/**/*` from typecheck (line 55), so TypeScript never validates the imports in pool-treasury-panel.tsx. The dead imports compile via webpack's bundler (which doesn't validate types) and ship to production unflagged. The test PoC explicitly asserts this exclusion at [PT-03 root cause].

**Exploit narrative / failure modes.**

1. **Confirmed today.** The frontend builds (because PT-13 hides the type errors), so a user opening the treasury panel triggers a runtime `ReferenceError`/`undefined is not a function` the moment any withdraw button is clicked. The button visibly does nothing or surfaces a generic error. There is no compile-time signal.
2. CI pipeline includes `frontend:build` ([package.json:61](../../package.json:61)) — but per PT-13 the typecheck step does not cover components. A fresh CI run will not catch this.
3. Worst case: a future developer notices the broken imports and "fixes" them by creating placeholder builders that send unsigned/empty instructions, masking the missing on-chain handlers and creating a confusion-of-confidence between operators and the UI.

**Remediation.** Choose one of:

- Delete `frontend/components/pool-treasury-panel.tsx` and any links to it. This is the right call until PT-01 / PT-02 are resolved.
- Once PT-01 / PT-02 ship real on-chain handlers, add the six builder exports to `frontend/lib/protocol.ts`, mirroring the patterns in `buildWithdrawProtocolFeeSplTx` siblings already in the panel (e.g., follow `buildDepositIntoCapitalClassTx` at protocol.ts:4102 as a structural template).

---

### [HIGH] PT-2026-04-27-04: Operator-routed claim diversion via unconstrained `args.claimant`

**Confidence:** 9/10  
**Class:** Authorization — latent  
**Severity:** **HIGH** if outflow paths ship without a fix; **LOW** today (claim_case.claimant is data-only)  
**PoC:** [`tests/security/program_authorization_gaps.test.ts::[PT-04]`](../../tests/security/program_authorization_gaps.test.ts) (two assertions)  
**Outcome:** `VULN_CONFIRMED`

The intake gate `require_claim_intake_submitter` (lib.rs:5166-5181) has two branches:

```rust
let member_self_submit =
    *authority == member_position.wallet && args.claimant == member_position.wallet;
let operator_submit = *authority == plan.claims_operator || *authority == plan.plan_admin;
```

The member self-submit branch correctly constrains `args.claimant` to equal the member wallet. The operator-submit branch does **not** — `args.claimant` can be any pubkey when a `claims_operator` or `plan_admin` is the signer. `open_claim_case` then assigns `claim_case.claimant = args.claimant` (lib.rs:1251), persisting the operator-supplied pubkey verbatim.

**Exploit narrative.** A `claims_operator` (today potentially the same key as governance — see PT-05) calls `open_claim_case` for a legitimate `member_position` but sets `args.claimant = attacker_wallet`. Anchor's context constraints accept this because:

- `member_position.health_plan == health_plan.key()` is required (good — cross-plan blocked)
- `member_position.policy_series == args.policy_series` is required (good — series locked)
- `member_position.active` and `eligibility_status == ELIGIBLE` are required (good — only-active members)
- `args.claimant` has **no constraint relative to `member_position.wallet`** in the operator branch.

The attacker-specified claimant is now persisted on-chain. The claim flows through `attach_claim_evidence_ref` → `adjudicate_claim_case` → `settle_claim_case` (today: ledger-only). When PT-01 / PT-02 ship outflow CPIs that route to `claim_case.claimant`, the diversion completes.

**Remediation.** Add the missing constraint to the operator branch:

```rust
let operator_submit = (*authority == plan.claims_operator || *authority == plan.plan_admin)
    && args.claimant == member_position.wallet;
```

If the team's design genuinely requires operator-supplied claimants for B2B/sponsor flows, add a separate explicit authorization (e.g., a delegation account proving the member opted in) and require it in the context. Today's gate is the wrong shape for that use case.

A negative Rust unit test should be added next to `claim_intake_submitter_rejects_unrelated_signers` (lib.rs:6930-7095): `claim_intake_submitter_rejects_operator_with_attacker_claimant`.

---

### [HIGH (config)] PT-2026-04-27-05: Single-key SPOF for Genesis launch

**Confidence:** 10/10  
**Class:** Operational concentration of authority  
**Severity:** **HIGH** for mainnet posture  
**PoC:** Existing test at [`tests/genesis_live_bootstrap_config.test.ts:23-24`](../../tests/genesis_live_bootstrap_config.test.ts) — already documents the default behavior  
**Outcome:** `VULN_CONFIRMED` (by existing test)

[`scripts/support/genesis_live_bootstrap_config.ts:287-338`](../../scripts/support/genesis_live_bootstrap_config.ts) defaults the following operator roles to `governanceAuthority` when their dedicated env vars are unset:

- `OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN` → defaults to governance
- `OMEGAX_LIVE_SPONSOR_WALLET` → defaults to governance
- `OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET` → defaults to governance

Combined with `OMEGAX_LIVE_ORACLE_WALLET` (which can be set to the same vanity wallet — see [`AGENTS.md`](../../AGENTS.md) reference to `oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h`), one keypair can hold:

- Governance authority (lib.rs:161, 204 — protocol pause, authority rotation)
- Plan admin / sponsor operator (lib.rs:374, 415 — plan + series + funding line creation)
- Claims operator (lib.rs:1295, 1354 — adjudicate + settle claims)
- Oracle authority (lib.rs:599, 4828 — eligibility + reserve operations)

The existing test `tests/genesis_live_bootstrap_config.test.ts` literally asserts `config.roles.sponsor === GOVERNANCE` and `config.roles.claimsOperator === GOVERNANCE` under a default env — the SPOF is encoded by design.

**Exploit narrative.** Compromise of one keypair (the operator's local file at `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH` plus the matching governance keypair, which today defaults to the same vanity wallet) compromises every protocol-level lever. With outflow paths missing today the immediate blast radius is limited to creating fake claims, faking adjudications, pausing the protocol, and rotating governance to a new attacker key. After PT-01 / PT-02 ship, the same compromise can also drain every vault.

**Remediation.**

1. **Mandatory before mainnet:** require all four env vars (`OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN`, `OMEGAX_LIVE_SPONSOR_WALLET`, `OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET`, `OMEGAX_LIVE_ORACLE_WALLET`) to be set to **distinct** keypairs in `loadGenesisLiveBootstrapConfig`. Add a validation that throws when any two roles resolve to the same pubkey.
2. **Strongly recommended:** replace the single governance keypair with a multisig (e.g., Squads V4) before mainnet bootstrap. The on-chain program treats `governance.governance_authority` as a single pubkey, so the multisig PDA acts as that pubkey transparently.

---

### [MEDIUM] PT-2026-04-27-06: Pre-sign review gate bypassed by 29 of 33 callsites

**Confidence:** 10/10  
**Class:** UX / authorization gate coverage  
**Severity:** **MEDIUM** today; **HIGH** once PT-01 / PT-02 outflow paths ship  
**PoC:** [`tests/security/pre_sign_review_coverage.test.ts`](../../tests/security/pre_sign_review_coverage.test.ts) (two assertions, plus structured callsite map)  
**Outcome:** `VULN_CONFIRMED`

The pre-sign review gate added in commit 3a09f95 is implemented as an **opt-in** in `frontend/lib/protocol-action.ts:83-99`:

```ts
if (params.review) {
  if (!params.confirmReview) {
    return { ok: false, error: "...requires a pre-sign review..." };
  }
  const approved = await params.confirmReview(review);
  if (!approved) { return { ok: false, error: "...cancelled..." }; }
}
```

When a caller omits `review:` from the `executeProtocolTransaction` params, the gate is skipped entirely. The PoC enumerates every callsite and reports coverage. Today's count (run on 2026-04-27):

- **4 of 33** callsites pass review metadata
- **29 of 33** callsites do not — including callsites in `pool-treasury-panel`, `pool-claims-panel`, `pool-oracles-panel`, `oracle-registry-verification-panel`, `governance-operator-drawer`, `governance-console`, `governance-proposal-detail-panel`, `pool-governance-panel`, `pool-schemas-panel`, `pool-coverage-panel`, `pool-liquidity-console`, `pool-settings-panel`, `oracle-profile-wizard`, and `pool-oracles-console`.

Full callsite map preserved in the PoC's `console.log` output during `npm run test:node`.

**Exploit narrative.** A compromised RPC endpoint OR a confused operator OR a malicious frontend dependency can inject transactions that change protocol state without triggering the review/confirmation flow. The gate exists; it just doesn't run for the majority of state-changing operations. The four reviewed callsites today are: `capital-operator-drawer.tsx:182` (deposits/redemptions for LPs), `plan-operator-drawer.tsx:535` (sponsor flows), and `plan-creation-wizard.tsx:1266 + 1285` (plan creation).

The 29 unreviewed callsites today touch: pool oracle assignment, pool oracle policy updates, pool schema updates, claim adjudication, treasury withdrawals (PT-03 dead UI), governance authority rotation, and protocol pause. All are state-changing.

**Remediation.** Pick one of two architectures:

1. **Mandatory gate** — change `executeProtocolTransaction` to require `review` for any caller that hasn't explicitly opted out via `review: { skip: true, reason: "..." }`. This forces every callsite to make a deliberate decision and document its rationale.
2. **Per-callsite review** — add `review:` blocks to every callsite that mutates protocol state. This is more work (~29 files) but more flexible.

In either case, add a unit test that runs over the components directory and asserts the desired coverage rule. The PT-06 PoC test can be flipped from a coverage map into a coverage assertion.

---

### [MEDIUM] PT-2026-04-27-07: Oracle profile pre-registration / squatting

**Confidence:** 9/10  
**Class:** Spoofing — bounded by `claim_oracle` recovery  
**Severity:** **MEDIUM**  
**PoC:** [`tests/security/program_authorization_gaps.test.ts::[PT-07]`](../../tests/security/program_authorization_gaps.test.ts) (two assertions)  
**Outcome:** `VULN_CONFIRMED`

`register_oracle` (lib.rs:1989-2012) sets `profile.oracle = args.oracle` and `profile.admin = ctx.accounts.admin.key()` without validating that the signer controls the oracle key. The PoC confirms there is no `require_keys_eq!(args.oracle, ctx.accounts.admin.key())` constraint and no equivalent `require!`. The only mitigation is `profile.claimed = (admin == args.oracle)` — a self-claimed flag that downstream consumers must check.

The PDA seeds for `oracle_profile` use `args.oracle` directly: `[SEED_ORACLE_PROFILE, args.oracle.as_ref()]`. So an attacker who registers under a target oracle's pubkey gets a deterministic PDA address that the rightful oracle would expect to control.

**Exploit narrative.** Attacker registers an `OracleProfile` for a known-public oracle pubkey (e.g., a Pyth or Switchboard oracle), supplying their own attacker wallet as `admin` and `display_name = "Pyth"`, `legal_name = "Pyth Data Association"`, `webhook_url = "https://attacker.example/pyth-impersonator"`. The profile is now indexed at the same PDA the rightful oracle would claim. Pool curators using off-chain indexers may surface this profile as the legitimate Pyth oracle.

The blast radius is bounded by `claim_oracle` (lib.rs:2025): the rightful oracle can call `claim_oracle` and reset `profile.admin = ctx.accounts.oracle.key()`. The PoC confirms `claim_oracle` requires `oracle.key() == oracle_profile.oracle`. So the squatter cannot block recovery.

The squatter also cannot abuse the profile to attest claims — `attest_claim_case` (lib.rs:2288) requires `oracle.key() == oracle_profile.oracle` (lib.rs:2821-2823), so only the actual oracle can attest. The squatter only controls **metadata** until recovery.

**Remediation.** Add the constraint:

```rust
require_keys_eq!(
    args.oracle,
    ctx.accounts.admin.key(),
    OmegaXProtocolError::Unauthorized
);
```

Or accept the squat-then-recover pattern with explicit documentation in the operator runbook (rightful oracles should run a "verify your oracle profile" step on first launch and call `claim_oracle` if metadata is wrong).

---

### [MEDIUM] PT-2026-04-27-08: NAV first-mover advantage on impairment timing

**Confidence:** 8/10 (static-analysis only; localnet PoC deferred)  
**Class:** Economic — pricing race condition  
**Severity:** **MEDIUM**  
**PoC:** Static-trace only; localnet PoC scoped but not executed  
**Outcome:** `INCONCLUSIVE-but-evidence-strong`

`request_redemption` (lib.rs:1633-1693) computes `asset_amount` at request time:

```rust
let asset_amount = redeemable_assets_for_shares(
    args.shares,
    ctx.accounts.capital_class.total_shares,
    ctx.accounts.capital_class.nav_assets,
)?;
```

This is locked into `lp_position.pending_redemption_assets` (lib.rs:1671-1674). Subsequently:

- A sentinel can call `mark_impairment` (lib.rs:1922) between `request_redemption` and `process_redemption_queue`, reducing `capital_class.nav_assets`.
- `process_redemption_queue` (lib.rs:1712-1716) reads `lp_position.pending_redemption_assets` (the locked-in amount), not the current NAV.
- The redemption pays out at the request-time price; subsequent LPs requesting redemption pay out at the post-impairment (lower) price.

**Exploit narrative.** LP-A and LP-B each hold 100 shares in a class at NAV 1:1. Class total = 1000 USDC against 1000 shares. LP-A learns (via off-chain channel) that the sentinel is about to mark a 50% impairment. LP-A requests redemption first; their `pending_redemption_assets = 100`. Sentinel marks impairment; class NAV is now 500 USDC against 1000 shares. LP-A's `process_redemption_queue` (today: ledger-only; tomorrow: with PT-02 fix, transfers 100 USDC). LP-B requests redemption afterward; their `pending_redemption_assets = 50` (post-impairment price). LP-A escapes losses; LP-B absorbs them disproportionately.

This is the classic "first-out-the-door" pattern in LP pools that price at request time without an end-of-period socialization.

**Why INCONCLUSIVE today.** With PT-01 / PT-02 outstanding, no real money moves on `process_redemption_queue` — the test that would fully confirm the exploit (LP-A's wallet receives more than fair share) cannot run end-to-end without first fixing PT-02. The static trace confirms the pricing-race shape; the economic impact only materializes after PT-02 is fixed.

**Remediation options.** Choose architecturally:

1. **NAV at process time.** Change `process_redemption_queue` to recompute `asset_amount` from current `total_shares` and `nav_assets`. Removes the race entirely but exposes LPs to NAV moves between request and process. Acceptable if process happens promptly.
2. **Snapshot total assets at impairment.** When a sentinel calls `mark_impairment`, scale all existing `pending_redemption_assets` proportionally. More fair to socialize the loss but requires iterating over `lp_position` accounts.
3. **Block impairment when redemption queue is non-empty.** Refuse `mark_impairment` if any `lp_position.queue_status == LP_QUEUE_STATUS_PENDING`. Forces drain-then-impair sequencing. Simpler but creates DoS (one stale pending redemption blocks impairment forever).
4. **Two-phase redemption with cooldown.** Require a settlement-period delay between `request_redemption` and `process_redemption_queue` (already partially implemented via `lockup_ends_at`); during the period, NAV moves apply pro-rata.

The existing protocol uses a queue-based model that suggests option 2 was intended. Confirm with the protocol designer.

A localnet PoC should be added once PT-02 is fixed: `e2e/security/nav_first_mover_impairment.test.ts` per the original plan.

---

### [LOW] PT-2026-04-27-09: PDA squatting via user-controlled `anchor_ref`

**Confidence:** 7/10  
**Class:** State integrity / rent griefing  
**Severity:** **LOW**  
**PoC:** Static reasoning only  
**Outcome:** `INCONCLUSIVE-deprioritized`

`open_member_position` (lib.rs:535) initializes a `membership_anchor_seat` with `init_if_needed` whose seeds include user-supplied `anchor_ref`. An attacker can pre-initialize seats with adversarial refs, paying their own rent. The blast radius is limited because the seat is per-`(health_plan, anchor_ref)`, and `anchor_ref` is bounded by Anchor's serialization length limits.

This is a known low-severity DoS class; not a blocker.

**Remediation if desired.** Constrain `anchor_ref` to a 32-byte hash so PDA addresses cannot collide with user-supplied vanity values, and document in the plan-launch runbook that operators should pre-create canonical anchor seats for known cohorts.

---

### [LOW (probe)] PT-2026-04-27-10: Lockup bypass surface

**Confidence:** 6/10  
**Class:** State integrity  
**Severity:** **LOW (not exploited in this review)**  
**Outcome:** `INCONCLUSIVE-deprioritized`

`request_redemption` (lib.rs:1644) checks `Clock::get()?.unix_timestamp >= ctx.accounts.lp_position.lockup_ends_at`. This review did not exhaustively test whether `lockup_ends_at` can be reset post-deposit by any handler. Recommended follow-up: write a Rust unit test that initializes an LP position with a future `lockup_ends_at`, then attempts every relevant mutator to see if it gets reset.

---

### [LOW (regression)] PT-2026-04-27-11: CSO-2026-04-27-01 (claim intake) regression suite

**Confidence:** 10/10  
**Class:** Authorization regression  
**Severity:** **LOW (defense holds)**  
**PoC:** [`tests/security/cso_01_intake_gate_regression.test.ts`](../../tests/security/cso_01_intake_gate_regression.test.ts) (three assertions)  
**Outcome:** `DEFENSE_HOLDS`

This finding documents that the CSO-01 fix is in place. The PoC verifies:

1. `open_claim_case` calls `require_claim_intake_submitter` early in its body.
2. `require_claim_intake_submitter` defines `member_self_submit` and `operator_submit` branches and errs `Unauthorized` when both fail.
3. The Anchor `OpenClaimCase` context binds `member_position.health_plan == health_plan.key()`, `funding_line.health_plan == health_plan.key()`, `member_position.policy_series == args.policy_series`, and `member_position.active`.

The existing Rust unit tests `claim_intake_submitter_rejects_unrelated_signers` and `claim_intake_submitter_rejects_member_claimant_override` (lib.rs:6196-7302) cover the runtime negative cases.

PT-04 documents the residual gap: the operator branch does not constrain `args.claimant`. That is an extension, not a CSO-01 regression.

---

### [HIGH] PT-2026-04-27-13: Frontend typecheck excludes `components/` and 6 critical lib files

**Confidence:** 10/10  
**Class:** Build / quality / structural defense-in-depth  
**Severity:** **HIGH** — explains how PT-03 ships, masks all type errors in components/, and excludes the pre-sign review gate itself from typecheck  
**PoC:** [`tests/security/treasury_panel_imports_unresolved.test.ts::[PT-03] frontend/tsconfig.json excludes components/...`](../../tests/security/treasury_panel_imports_unresolved.test.ts)  
**Outcome:** `VULN_CONFIRMED`

`frontend/tsconfig.json:35-63` defines a narrow include list and an active exclude list. The PoC dumps the actual configuration during `npm run test:node` (run on 2026-04-27):

```text
[PT-03] tsconfig include for lib/: ["lib/console-model.ts","lib/devnet-fixtures.ts","lib/protocol.ts","lib/generated/**/*.ts"]
[PT-03] tsconfig exclude: ["node_modules","components/**/*","lib/cycle-quote.ts","lib/governance.ts","lib/pool-defi-metrics.ts","lib/protocol-action.ts","lib/protocol-workspace-mappers.ts","lib/schema-metadata.ts","lib/ui-capabilities.ts"]
```

What this means in practice:

- **Every file in `frontend/components/` (~30+ React components) is not typechecked** during `next build`. Type errors, broken imports, missing props, and `null`-deref hazards in any component all ship without a compile-time signal.
- **`lib/protocol-action.ts` is not typechecked** even though it implements the pre-sign review gate that this audit is examining (PT-06). Type errors in the gate logic — including the conditional branching at [protocol-action.ts:83-99](../../frontend/lib/protocol-action.ts) — would not surface at build time.
- **`lib/governance.ts`, `lib/pool-defi-metrics.ts`, `lib/schema-metadata.ts`, `lib/ui-capabilities.ts`** are also excluded — these touch pool metrics, schema metadata, and UI capability gating, all sensitive surfaces.

This is a defense-in-depth failure that compounds with every other finding: the pre-sign review gate (PT-06), the dead treasury imports (PT-03), the operator authorization gap (PT-04), and any future change to the React components are all uncovered by the strongest static safety net the team has.

**Exploit narrative.** This is not directly exploitable — it is a quality/safety regression that allowed PT-03 to ship and would allow future structural breaks to ship. An attacker doesn't exploit a tsconfig; an attacker exploits the bugs that ship because the tsconfig doesn't catch them.

**Remediation.**

1. Move `components/**/*.tsx` and the six excluded lib files into the `include` array (or remove them from `exclude`). Address any type errors that surface — they are pre-existing and currently invisible.
2. Add a regression test that runs `tsc --noEmit` directly on the full source tree (not just what tsconfig.json covers) so future exclusions cannot silently grow.
3. Set `next.config.*`'s `typescript.ignoreBuildErrors: false` (default, but verify) and confirm `next build` honors the project's tsconfig fully.

If the team excluded these files because of pre-existing type errors that are intentionally deferred, document the deferral explicitly with a TODO/FIXME and a tracking ticket — silent exclusion is the wrong shape.

---

### [INFO] PT-2026-04-27-12: `recompute_sheet` saturating-sub on derived display fields

**Confidence:** 9/10  
**Class:** Cosmetic — derived-field saturation  
**Severity:** **INFO**  
**PoC:** [`tests/security/recompute_sheet_saturating_sub.test.ts`](../../tests/security/recompute_sheet_saturating_sub.test.ts) (three assertions)  
**Outcome:** `DEFENSE_HOLDS`

Earlier static-analysis claimed that `sheet.free = sheet.funded.saturating_sub(encumbered)` (lib.rs:5687) and `sheet.redeemable = sheet.funded.saturating_sub(redeemable_encumbered)` (lib.rs:5691) could mask insolvency. Inspection of the load-bearing fields shows otherwise: `sheet.funded`, `sheet.allocated`, `sheet.reserved`, `sheet.claimable`, etc. are all updated via `checked_add` / `checked_sub`. Any attempt to drive insolvency through the actual money paths surfaces an `ArithmeticError` and aborts the transaction. The saturating subtraction only affects **derived display fields** that are recomputed on every state mutation. The PoC verifies all three claims.

No remediation required.

---

## Mainnet readiness checklist

| ID | Severity | Status | Required for mainnet? |
|---|---|---|---|
| PT-01 | CRITICAL | OPEN | **YES — design + ship** |
| PT-02 | CRITICAL | OPEN | **YES — design + ship** |
| PT-03 | HIGH | OPEN | **YES — delete or wire** |
| PT-04 | HIGH (latent) | OPEN | **YES — fix before PT-02 ships** |
| PT-05 | HIGH (config) | OPEN | **YES — split keys / multisig** |
| PT-13 | HIGH | OPEN | **YES — restore typecheck coverage** |
| PT-06 | MEDIUM | OPEN | YES — coverage policy |
| PT-07 | MEDIUM | OPEN | Recommended |
| PT-08 | MEDIUM | OPEN | Recommended (post-PT-02 PoC) |
| PT-09 | LOW | OPEN | No |
| PT-10 | LOW (probe) | OPEN | Probe before mainnet |
| PT-11 | LOW (regression) | DEFENSE_HOLDS | No (verified) |
| PT-12 | INFO | DEFENSE_HOLDS | No (verified) |

---

## Verification

How to reproduce the findings:

```sh
# Static-analysis PoCs (all 18 assertions)
node --import tsx --test tests/security/*.test.ts
# OR via the project's standard runner:
npm run test:node

# Rust unit tests (CSO-01 regression: claim_intake_submitter_*)
npm run rust:test

# Frontend build (PT-03 may surface here)
npm --prefix frontend run build

# Repo-wide hygiene
npm run verify:public
```

Last run (2026-04-27):
- `npm run test:node` — 114/114 green, including all 19 security PoCs (one added post-build for PT-13)
- `npm run rust:test` — 36/36 green, including the four `claim_intake_submitter_*` tests cited under PT-11
- `npm --prefix frontend run build` — exit 0; this is the **PT-03 / PT-13 evidence**: the build succeeds despite the dead imports because tsconfig excludes components from typecheck

Each assertion's pass/fail is the verification record. When the team remediates a finding, the corresponding PoC should fail — at that point the PoC should either be deleted or flipped into a defense test.

---

## Out of scope

This review explicitly did not re-test items already covered by the CSO 2026-04-27 audit:
- CI/CD action pinning, branch protection, CODEOWNERS
- npm/cargo dependency advisories
- Skill-manifest supply chain

This review explicitly deferred:
- Live localnet PoCs (every CRITICAL/HIGH finding is fully proved by static analysis; only PT-08 would benefit, and only after PT-02 is fixed)
- Mainnet RPC infrastructure and wallet adapter security
- Operator OS / keypair-file custody
- Property-based / fuzz testing

---

## Appendix A — Files added by this review

- `tests/security/no_money_out_path.test.ts` — PT-01, PT-02
- `tests/security/treasury_panel_imports_unresolved.test.ts` — PT-03, PT-13
- `tests/security/program_authorization_gaps.test.ts` — PT-04, PT-07
- `tests/security/pre_sign_review_coverage.test.ts` — PT-06
- `tests/security/recompute_sheet_saturating_sub.test.ts` — PT-12
- `tests/security/cso_01_intake_gate_regression.test.ts` — PT-11
- `docs/security/pre-mainnet-pen-test-2026-04-27.md` — this report

No production code or operator scripts modified.

---

## Appendix B — Pre-sign review coverage map (from PT-06 PoC, 2026-04-27)

**4 / 33 callsites pass review metadata.**

Without review (29 callsites):

| Component | Lines |
|---|---|
| governance-console.tsx | 238-243, 271-276, 303-308, 342-347 |
| governance-operator-drawer.tsx | 147 |
| governance-proposal-detail-panel.tsx | 99-104, 133-138, 171-176 |
| oracle-profile-wizard.tsx | 571-576, 632-637 |
| oracle-registry-verification-panel.tsx | 419-424 |
| pool-claims-panel.tsx | 422-427 |
| pool-coverage-panel.tsx | 559-564 |
| pool-governance-panel.tsx | 132-137, 168-173, 201-206 |
| pool-liquidity-console.tsx | 297-302 |
| pool-oracles-console.tsx | 435-441 |
| pool-oracles-panel.tsx | 272-277, 306-311, 344-349 |
| pool-schemas-panel.tsx | 163-168, 196-201, 234-239, 271-276 |
| pool-settings-panel.tsx | 348-353 |
| pool-treasury-panel.tsx | 184-189, 229-234, 276-281 |

With review (4 callsites):

| Component | Lines |
|---|---|
| capital-operator-drawer.tsx | 182-194 |
| plan-creation-wizard.tsx | 1266-1278, 1285-1297 |
| plan-operator-drawer.tsx | 535-547 |
