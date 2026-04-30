# OmegaX Protocol — Codex Adversarial Challenge

- **Date:** 2026-04-29
- **Reviewer:** OpenAI Codex (gpt-5.5, codex-cli 0.125.0, `model_reasoning_effort="high"`)
- **Driver:** Claude Code via `/gstack-codex challenge`
- **Scope:** Holistic safety-property audit of `programs/omegax_protocol/src/lib.rs` (~9000 LOC) and `programs/omegax_protocol/src/core_accounts.rs`. Frontend (`frontend/lib/protocol.ts`) in scope only as it affects on-chain instruction construction.
- **Mode:** Defensive pre-mainnet hardening review, framed as 10 safety properties to verify.
- **Companion to:** [`docs/security/pre-mainnet-pen-test-2026-04-27.md`](pre-mainnet-pen-test-2026-04-27.md) (PT-01 .. PT-13 already remediated; this run is fresh ground).
- **Codex run cost:** 1,038,311 tokens, ~4 minutes wall clock.

> Historical note: this report reflects the pre-refactor file layout. The later audit-readability cleanup kept the protocol surface intact, moved implementation into audit-domain modules, and removed `src/core_accounts.rs` from live program source.

---

## Remediation Update — 2026-04-29

The pre-mainnet hardening patch following this report remediated the three confirmed fund-flow blockers:

- **FINDING-9:** `deposit_into_capital_class` no longer honors caller-supplied shares. The existing `shares` wire field is now interpreted as `min_shares_out`; actual issued shares are derived from current `total_shares / nav_assets`, with 1:1 bootstrap only for an empty class.
- **FINDING-6:** v1 custody rails now require the classic SPL Token program and reject Token-2022 mint/program ownership at vault creation and transfer helper boundaries.
- **Fee-withdraw recipient risk:** protocol, pool-treasury, and pool-oracle fee vaults now store `fee_recipient`; SOL withdrawals must pay that address directly, and SPL withdrawals must pay a token account owned by that address.

Validation for the remediation: `npm run anchor:idl`, `npm run protocol:contract`, `npm run rust:test`, `npm run test:node`, `npm run verify:public`, and `npm run test:e2e:localnet`.

## Verdict

**Codex verdict:** `MUST-FIX-BEFORE-MAINNET`
**Totals:** P0 = 1, P1 = 4, P2 = 3, P3 = 0

**Claude verification:** All 10 findings cross-checked against actual source. **Every "DOES_NOT_HOLD" / "PARTIAL" claim is grounded in real code at the cited file:line.** No false positives. One severity downgrade noted (PROPERTY-1 is defense-in-depth, runtime checks already catch the issue at handler time).

The team should treat this report as a **must-fix gate before mainnet**, with PROPERTY-9 (deposit shares math) as the single highest-priority item. PT-08 in the prior pen-test was withdrawn because impairment doesn't mutate NAV — but Codex found a **different, larger NAV first-mover bug** in the deposit-shares math itself that the prior review did not surface.

### Severity legend

- **P0** — direct fund-loss path (existing LPs lose value to a dust attacker)
- **P1** — fee leakage, mis-routing, or defense-in-depth gap that compounds with other compromise
- **P2** — DoS, griefing, or operational risk
- **P3** — informational

---

## Summary table

| # | Property | Codex status | Severity | Verified | Fix priority |
|---|----------|--------------|----------|----------|--------------|
| 1 | Fee-vault account binding integrity | DOES_NOT_HOLD | P1 | ✅ true (defense-in-depth gap; runtime checks DO catch wrong vaults at handler time) | High |
| 2 | Withdraw-rail account isolation (recipient owner) | PARTIAL | P1 | ✅ true | High |
| 3 | Oracle fee accrual binding (vault ↔ adjudicator) | DOES_NOT_HOLD | P1 | ✅ true | High |
| 4 | PDA seed canonicality + init re-init protection | HOLDS | — | ✅ confirmed | — |
| 5 | Curator authority scope | PARTIAL | P2 | ✅ true | Medium |
| 6 | Token program / mint extension safety | DOES_NOT_HOLD | P1 | ✅ true | **Critical** (Token-2022) |
| 7 | SOL-rail lamport accounting | HOLDS | — | ✅ confirmed | — |
| 8 | Settlement recipient routing under `delegate_recipient` | PARTIAL | P2 | ✅ true | Medium |
| 9 | **Capital-class deposit shares math** | **DOES_NOT_HOLD** | **P0** | ✅ true (NAV first-mover via deposit pricing) | **Critical** |
| 10 | Authority rotation (no two-step accept) | DOES_NOT_HOLD | P2 | ✅ true | Medium |

---

## Findings

### FINDING-1 — Optional fee-vault accounts lack canonical PDA seed bindings

- **Severity:** P1 (defense-in-depth gap)
- **Status:** DOES_NOT_HOLD per Codex; verified at handler-runtime level the attack is blocked, but Anchor account-resolution is loose.
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:3514`](../../programs/omegax_protocol/src/lib.rs#L3514) — `RecordPremiumPayment.protocol_fee_vault: Option<...>` with only `#[account(mut)]`
  - [`programs/omegax_protocol/src/lib.rs:3813`](../../programs/omegax_protocol/src/lib.rs#L3813) — `SettleClaimCase.protocol_fee_vault` (same pattern)
  - [`programs/omegax_protocol/src/lib.rs:3822`](../../programs/omegax_protocol/src/lib.rs#L3822) — `SettleClaimCase.pool_oracle_fee_vault` (same pattern)
  - [`programs/omegax_protocol/src/lib.rs:3827`](../../programs/omegax_protocol/src/lib.rs#L3827) — `SettleClaimCase.pool_oracle_policy` (same pattern)
- **Pre-conditions:** A privileged operator (claims_operator, sponsor_operator, plan_admin) supplies a fee-vault account during a flow.
- **Verification:** Runtime checks DO exist:
  - `record_premium_payment` checks `protocol_fee_vault.reserve_domain == health_plan.reserve_domain` at lines 977–986
  - `deposit_into_capital_class` checks `pool_treasury_vault.liquidity_pool == pool.key()` and `vault.asset_mint == pool_deposit_mint` at lines 1979–1988
  - `settle_claim_case` runs the same `vault.liquidity_pool == policy.liquidity_pool` and asset-mint checks at lines 1672–1689
  - So the immediate attack ("substitute attacker-controlled vault") IS blocked at runtime, but ONLY for the parent reference + asset mint. There is no Anchor seed binding asserting the supplied vault is the **canonical** PDA for that (parent, mint).
- **Impact:** Defense-in-depth. If a future code change drops one of the runtime checks, or if a new caller path forgets to validate, the vault could silently route to a wrong destination. With seeds in the `#[derive(Accounts)]`, Anchor would refuse the wrong account at instruction-decode time.
- **Recommended fix:** Add explicit seeds + bumps to every optional fee-vault account:
  ```rust
  #[account(
      mut,
      seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
      bump = protocol_fee_vault.bump,
      constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
  )]
  pub protocol_fee_vault: Option<Box<Account<'info, ProtocolFeeVault>>>,
  ```
  Apply to all four optional vault account fields. Anchor handles `Option<...>` with seeds correctly when present.

---

### FINDING-2 — SPL withdraw recipient_token_account has no owner constraint

- **Severity:** P1 (defense-in-depth; matters under privileged-key compromise)
- **Status:** PARTIAL
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:4073`](../../programs/omegax_protocol/src/lib.rs#L4073) — `WithdrawProtocolFeeSpl.recipient_token_account`
  - [`programs/omegax_protocol/src/lib.rs:4131`](../../programs/omegax_protocol/src/lib.rs#L4131) — `WithdrawPoolTreasurySpl.recipient_token_account`
  - [`programs/omegax_protocol/src/lib.rs:4198`](../../programs/omegax_protocol/src/lib.rs#L4198) — `WithdrawPoolOracleFeeSpl.recipient_token_account`
- **Pre-conditions:** A privileged signer (governance, curator, oracle, or oracle_profile.admin) calls a withdraw instruction.
- **Concrete evidence:** Each `recipient_token_account` is declared as:
  ```rust
  #[account(mut)]
  pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
  ```
  with no `constraint = recipient_token_account.owner == ...`. The transfer helper `transfer_from_domain_vault` only checks the mint matches and rejects self-transfers (lib.rs:6899–6923).
- **Impact:** A privileged-key compromise (governance keypair, pool curator, oracle admin) drains accrued fees to ANY ATA of the correct mint — including the attacker's. A typo by a benign operator could send fees to a wrong wallet. Does not enable an unprivileged attack, but eliminates an important defense-in-depth check.
- **Recommended fix:** Either:
  1. Pin to a configured fee-recipient pubkey stored on the vault state (preferred — no operator typo risk):
     ```rust
     #[account(
         mut,
         constraint = recipient_token_account.owner == protocol_fee_vault.configured_recipient
             @ OmegaXProtocolError::Unauthorized,
     )]
     pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
     ```
     and add `pub configured_recipient: Pubkey,` to each vault state struct; require governance to set it via a separate `set_fee_recipient` ix (event-emitted, audit-logged).
  2. As a minimum, require `recipient_token_account.owner == authority.key()` so fees can only be withdrawn to the signer's own ATA — collapses the threat model to "the privileged signer's own keypair."

---

### FINDING-3 — Oracle fee vault not bound to the adjudicator on settlement

- **Severity:** P1 (fee mis-routing across oracles in the same pool)
- **Status:** DOES_NOT_HOLD
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:1672-1689`](../../programs/omegax_protocol/src/lib.rs#L1672) — settle_claim_case oracle_fee accrual
  - [`programs/omegax_protocol/src/lib.rs:5022`](../../programs/omegax_protocol/src/lib.rs#L5022) — `PoolOraclePolicy` struct
  - [`programs/omegax_protocol/src/lib.rs:3822`](../../programs/omegax_protocol/src/lib.rs#L3822) — optional `pool_oracle_fee_vault` account
- **Pre-conditions:** Multiple oracles can serve the same `(liquidity_pool, asset_mint)`. A claims_operator settles a claim and supplies a `pool_oracle_fee_vault` belonging to oracle B, while the actual adjudicator on the claim is oracle A.
- **Concrete evidence:** `PoolOraclePolicy` (line 5022) stores only `liquidity_pool`, quorum, schema flag, `oracle_fee_bps`, delegate flag, challenge window, ts, bump. **It does NOT carry `oracle: Pubkey` or `asset_mint: Pubkey`.** The settlement check at lines 1672–1689 verifies:
  - `vault.asset_mint == funding_line.asset_mint` ✅
  - `vault.liquidity_pool == policy.liquidity_pool` ✅
  - **No check that `vault.oracle == claim_case.adjudicator`** ❌
- **Impact:** In a pool with N oracles, an operator can credit oracle B's fee vault for adjudication work performed by oracle A, redirecting the revshare. With the per-call magnitude bounded by `oracle_fee_bps` × claim amount, the cumulative drain is significant for a high-volume pool.
- **Recommended fix:** Two changes, both required:
  1. In `settle_claim_case` body, add:
     ```rust
     require_keys_eq!(
         vault.oracle,
         claim_case.adjudicator,
         OmegaXProtocolError::OracleProfileMismatch
     );
     ```
  2. In `SettleClaimCase` accounts struct (line 3822), bind seeds:
     ```rust
     #[account(
         mut,
         seeds = [
             SEED_POOL_ORACLE_FEE_VAULT,
             liquidity_pool.key().as_ref(),
             claim_case.adjudicator.as_ref(),
             funding_line.asset_mint.as_ref(),
         ],
         bump = pool_oracle_fee_vault.bump,
     )]
     pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
     ```
  Anchor account-resolution will then refuse a wrong-oracle vault before the body runs.

---

### FINDING-4 — VECTOR HOLDS

PROPERTY-4 holds. Init handlers (`init_protocol_fee_vault` line 340, `init_pool_treasury_vault` line 380, `init_pool_oracle_fee_vault` line 425) use canonical seeds and Anchor `init` constraint rejects re-init. Authority gating: governance for protocol rail, curator for pool rails. No squatting path found.

---

### FINDING-5 — Curator unilateral discretion on redemption queue and treasury

- **Severity:** P2 (operational risk; LP payout routing IS protected)
- **Status:** PARTIAL
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:2122`](../../programs/omegax_protocol/src/lib.rs#L2122) — `process_redemption_queue` `require_curator_control`
  - [`programs/omegax_protocol/src/lib.rs:2223-2226`](../../programs/omegax_protocol/src/lib.rs#L2223) — recipient owner pinned to `lp_position.owner` ✅
  - [`programs/omegax_protocol/src/lib.rs:2345-2349`](../../programs/omegax_protocol/src/lib.rs#L2345) — `withdraw_pool_treasury_*` `require_curator_control`
- **Pre-conditions:** Pool curator is single-keyed (no multisig at protocol level).
- **Concrete evidence:** Redemption recipient IS pinned to `lp_position.owner` — curator cannot redirect LP payouts (good, codex confirms). But curator alone decides:
  - Order in which queued redemptions are processed (no FIFO invariant on-chain)
  - Timing (no minimum wait between request and process)
  - Whether to process at all (no governance pressure)
  - All `withdraw_pool_treasury_spl/sol` recipient routing (combined with FINDING-2's missing recipient owner constraint, a curator key compromise drains the treasury rail to attacker-controlled ATAs)
- **Impact:** Curator-key compromise drains pool treasury fees and can grief LPs by reordering or stalling redemptions. Not a direct LP-fund-loss vector (recipient is pinned).
- **Recommended fix:**
  1. Add a configured `treasury_recipient` field on `LiquidityPool` and constrain `withdraw_pool_treasury_*` to that recipient (combine with FINDING-2 fix).
  2. Add a FIFO ordering invariant + minimum processing delay on `process_redemption_queue` (already documented as PT-08-adjacent in the prior pen-test).
  3. Multisig is operational, not code — covered in `docs/security/mainnet-privileged-role-controls.md`.

---

### FINDING-6 — Token-2022 accepted without extension safety checks (CRITICAL for asset choice)

- **Severity:** P1 (CRITICAL if the team plans to accept Token-2022 mints)
- **Status:** DOES_NOT_HOLD
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:6`](../../programs/omegax_protocol/src/lib.rs#L6) — `use anchor_spl::token_interface::{...};`
  - [`programs/omegax_protocol/Cargo.toml`](../../programs/omegax_protocol/Cargo.toml) — `anchor-spl = "0.32.1"`
  - All `vault_token_account: InterfaceAccount<'info, TokenAccount>` and `asset_mint: InterfaceAccount<'info, Mint>` fields throughout
- **Pre-conditions:** Any operator initializes a `domain_asset_vault` with a Token-2022 mint that has the transfer-fee or transfer-hook extension enabled.
- **Concrete evidence:** The program imports `token_interface` (the Token-2022-compatible interface), declares all token accounts and mints as `InterfaceAccount<...>`, and uses `Interface<TokenInterface>` for the token program. There is **no constraint excluding Token-2022 mints**, no `asset_mint.to_account_info().owner == &anchor_spl::token::ID` check, and no inspection of mint extensions.
- **Concrete impact paths:**
  - **Transfer-fee extension:** `transfer_to_domain_vault` deducts `args.amount` from source but the vault receives `amount - transfer_fee`. The protocol then books `total_assets += amount` — **NAV is overstated** by exactly the transfer fee on every deposit.
  - **Transfer-hook extension:** A hook program runs on every transfer. A malicious hook can re-enter the OmegaX program through any other instruction (Solana CPI is single-call but the hook is called BEFORE return), arbitrarily mutating state if the hook author calls the program back. CEI (checks-effects-interactions) is not enforced — `deposit_into_capital_class` does the SPL transfer (line 1957) BEFORE state mutation (line 2008+), and `withdraw_*_fee_*` does the transfer (line 2287) BEFORE bumping `withdrawn_fees` (line 2288).
  - **Confidential-transfer extension:** Amount is cryptographically hidden. `transfer_checked` may not even surface the real amount.
- **Recommended fix (pick one):**
  1. **For mainnet launch (recommended):** restrict to classic SPL Token only. Add to every relevant accounts struct:
     ```rust
     #[account(
         constraint = asset_mint.to_account_info().owner == &anchor_spl::token::ID
             @ OmegaXProtocolError::Token2022NotSupported,
     )]
     pub asset_mint: InterfaceAccount<'info, Mint>,
     #[account(
         constraint = token_program.key() == anchor_spl::token::ID
             @ OmegaXProtocolError::Token2022NotSupported,
     )]
     pub token_program: Interface<'info, TokenInterface>,
     ```
  2. **If Token-2022 must be supported:** explicitly inspect mint extensions, reject `TransferHook`, `TransferFeeConfig`, `ConfidentialTransferMint`, `PermanentDelegate`, `MintCloseAuthority`. Reorder all fund-flow handlers to mutate state BEFORE CPI (CEI pattern). Add a reentrancy guard on the program PDA.

  Option 1 is the right call for the v1 launch. Token-2022 is a much larger surface than the Phase 1.6/1.7 work just consolidated.

---

### FINDING-7 — VECTOR HOLDS

PROPERTY-7 holds. `require_fee_vault_balance` correctly uses checked `withdrawn + requested <= accrued` (no underflow), and `transfer_lamports_from_fee_vault` preserves rent-exempt minimum AFTER the transfer. SOL vaults cannot be drained below rent-exemption.

---

### FINDING-8 — `delegate_recipient` can change between approval and settlement

- **Severity:** P2 (member-controlled action; "self-harm" or social-engineering vector)
- **Status:** PARTIAL
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:1512-1524`](../../programs/omegax_protocol/src/lib.rs#L1512) — `authorize_claim_recipient` handler (no status gate)
  - [`programs/omegax_protocol/src/lib.rs:3698-3721`](../../programs/omegax_protocol/src/lib.rs#L3698) — `AuthorizeClaimRecipient` accounts (member-only ✅)
- **Pre-conditions:** Member's keypair signs `authorize_claim_recipient` after the claim is adjudicated/approved but before `settle_claim_case` runs.
- **Concrete evidence:** The handler body is:
  ```rust
  let claim_case = &mut ctx.accounts.claim_case;
  claim_case.delegate_recipient = args.delegate_recipient;
  claim_case.updated_at = Clock::get()?.unix_timestamp;
  Ok(())
  ```
  No `require!(claim_case.intake_status < CLAIM_INTAKE_APPROVED ...)` gate. No paid-amount check. Member can mutate the recipient arbitrarily late in the lifecycle.
- **Impact:** Approval/audit was performed assuming member's wallet was the recipient; member can redirect to a third-party wallet right before settlement. May violate KYC/AML or reviewer-trust assumptions. Not a fund-loss vector for OmegaX (member-authorized) but breaks the audit chain.
- **Recommended fix:**
  ```rust
  pub fn authorize_claim_recipient(...) -> Result<()> {
      require_protocol_not_paused(...)?;
      let claim_case = &ctx.accounts.claim_case;
      require!(
          claim_case.intake_status < CLAIM_INTAKE_APPROVED,
          OmegaXProtocolError::ClaimRecipientLocked
      );
      require!(
          claim_case.paid_amount == 0,
          OmegaXProtocolError::ClaimRecipientLocked
      );
      // ... mutate ...
  }
  ```
  Or snapshot `settlement_recipient` onto the claim_case at adjudication time so settlement uses the snapshotted value, ignoring later `delegate_recipient` changes.

---

### FINDING-9 — `deposit_into_capital_class` shares math is wrong (NAV first-mover via dust deposit)

- **Severity: P0 — direct fund loss to existing LPs**
- **Status:** DOES_NOT_HOLD
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:1947-2052`](../../programs/omegax_protocol/src/lib.rs#L1947) — `deposit_into_capital_class` handler
  - [`programs/omegax_protocol/src/lib.rs:1995-2001`](../../programs/omegax_protocol/src/lib.rs#L1995) — the broken shares calculation
  - [`programs/omegax_protocol/src/lib.rs:2008-2015`](../../programs/omegax_protocol/src/lib.rs#L2008) — `nav_assets` and `total_shares` updated naively
- **Pre-conditions:** A capital class with `restriction_mode == OPEN`, `min_lockup_seconds == 0` (or already elapsed), and an existing NAV ratio ≠ 1:1 (i.e., the pool has accumulated returns OR taken impairments OR has accrued fees that affect nav_assets).
- **The bug:** Lines 1995–2001 read:
  ```rust
  let shares = if args.shares == 0 {
      net_amount  // ← uses 1:1 ratio with deposit, ignoring existing nav_assets / total_shares
  } else {
      args.shares  // ← honors caller-supplied shares verbatim, no validation
  };
  ```
  Both branches are wrong:
  - **Default branch (args.shares == 0):** mints `net_amount` shares regardless of whether existing share price is 0.5x, 2x, or 10x of 1:1. This is the textbook NAV first-mover attack.
  - **Caller-supplied branch (args.shares != 0):** honors any number the caller passes. Caller can set `args.shares = 1` for a `args.amount = 1_000_000` deposit (severely undermint and donate to LPs) OR `args.shares = 1_000_000_000` for a `args.amount = 1` deposit (severely overmint and steal from LPs).
- **Exploit (concrete steps):**
  1. Pool has existing `nav_assets = 10_000`, `total_shares = 1_000` (share price = 10).
  2. Attacker (any signer if class is OPEN) calls `deposit_into_capital_class` with `args.amount = 1`, `args.shares = 0`.
  3. Handler computes `net_amount = 1`, `shares = 1` (default branch). Mints attacker 1 share.
  4. Pool state: `nav_assets = 10_001`, `total_shares = 1_001`. New share price = 9.99.
  5. Attacker calls `request_redemption` (or waits for lockup if any), then `process_redemption_queue` is called by curator/governance.
  6. Attacker's 1 share redeems at NAV: `(1 / 1_001) × 10_001 ≈ 9.99` units.
  7. **Profit: ~8.99 units stolen from existing LPs per dust deposit.** Repeat at scale.
  
  The `args.shares != 0` branch is even worse — attacker passes `args.shares = u64::MAX / 2` for `args.amount = 1`, mints astronomical shares, then redeems for the entire pool minus 1 unit on the next available redemption.
- **Why the prior pen-test missed this:** PT-08 was scoped to "NAV first-mover via impairment timing," and impairment was confirmed not to mutate `nav_assets`. But the bug isn't impairment-related — it's in the **deposit** math itself, which uses a 1:1 ratio whenever the caller doesn't supply shares (and trusts the caller when they do). Any source of NAV ≠ shares (accumulated returns, fee carve-outs that subtract from `nav_assets` differently than `total_shares`) creates the attack window.
- **Recommended fix:** Replace lines 1995–2001 with the correct AMM-style mint formula:
  ```rust
  // Phase 1.6 fee carve-out: net_amount is post-entry-fee
  let class = &ctx.accounts.capital_class;
  let shares = if class.total_shares == 0 || class.nav_assets == 0 {
      // Bootstrap: first deposit sets the 1:1 baseline
      net_amount
  } else {
      // Subsequent deposits: mint pro-rata at current NAV
      // shares = (net_amount * total_shares) / nav_assets
      u64::try_from(
          (net_amount as u128)
              .checked_mul(class.total_shares as u128)
              .ok_or(OmegaXProtocolError::ArithmeticOverflow)?
              .checked_div(class.nav_assets as u128)
              .ok_or(OmegaXProtocolError::ArithmeticOverflow)?
      ).map_err(|_| OmegaXProtocolError::ArithmeticOverflow)?
  };
  // Stop honoring caller-supplied args.shares for OPEN classes.
  // Allow it ONLY for restricted/wrapper classes where the caller is a credentialed subscription manager.
  ```
  Additionally — **add a settlement-delay or epoch-snapshot** so that even with correct math, a deposit cannot atomically deposit→redeem in the same epoch (defends against any future rounding-error variant).

---

### FINDING-10 — Single-step `rotate_protocol_governance_authority` (bricking risk)

- **Severity:** P2 (operational; not exploitable without governance signature)
- **Status:** DOES_NOT_HOLD
- **Files:**
  - [`programs/omegax_protocol/src/lib.rs:193-209`](../../programs/omegax_protocol/src/lib.rs#L193) — handler
  - [`programs/omegax_protocol/src/lib.rs:6010-6022`](../../programs/omegax_protocol/src/lib.rs#L6010) — state mutation
- **Pre-conditions:** Current governance signs a rotation transaction.
- **Concrete evidence:** Rotation immediately writes `governance.governance_authority = new_governance_authority`. Only zero-pubkey is rejected. There is no pending authority field, no separate accept step, no timeout / cancel path, and no recovery mechanism in the account state.
- **Impact:** A single bad rotation (typo, dead key, misconfigured multisig, lost device) permanently bricks every governance-gated operation: protocol pause, fee withdrawals, authority changes, schema updates. The protocol becomes inoperable; only a redeploy with state migration (impossible for a live program with funds custody) recovers it.
- **Recommended fix:** Two-step rotation:
  ```rust
  // Step 1: current authority proposes
  pub fn propose_governance_authority(ctx, new_authority: Pubkey) -> Result<()> {
      require_governance(...);
      let g = &mut ctx.accounts.protocol_governance;
      g.pending_governance_authority = new_authority;
      g.pending_proposed_at = Clock::get()?.unix_timestamp;
      Ok(())
  }
  // Step 2: new authority accepts (must sign)
  pub fn accept_governance_authority(ctx) -> Result<()> {
      let g = &mut ctx.accounts.protocol_governance;
      require_keys_eq!(ctx.accounts.new_authority.key(), g.pending_governance_authority, ...);
      // Optional: enforce minimum delay between propose and accept
      g.governance_authority = g.pending_governance_authority;
      g.pending_governance_authority = Pubkey::default();
      Ok(())
  }
  // Step 3: current authority can cancel before accept
  pub fn cancel_governance_authority_proposal(ctx) -> Result<()> { ... }
  ```

---

## Recommended fix order (priority-ranked)

1. **FINDING-9 (P0):** Fix `deposit_into_capital_class` shares math. This is the single largest exploitable bug. Add a Rust unit test that asserts `shares = (net_amount * total_shares) / nav_assets` for all `(nav_assets, total_shares)` ≠ `(0, 0)`, AND a localnet e2e that runs the dust-deposit attack and confirms it now fails (or yields zero profit).
2. **FINDING-6 (P1, CRITICAL for asset choice):** Lock to classic SPL Token for v1 launch. Add the mint-owner constraint; defer Token-2022 support to a separately-audited Phase 2.
3. **FINDING-3 (P1):** Bind `pool_oracle_fee_vault` to `claim_case.adjudicator` via both `require_keys_eq!` and Anchor seeds.
4. **FINDING-2 (P1):** Add recipient-owner constraint on all 3 SPL withdraw rails (pin to a configured fee-recipient field on each vault state).
5. **FINDING-1 (P1):** Tighten Anchor seeds on every optional fee-vault account (defense-in-depth).
6. **FINDING-8 (P2):** Add status gate to `authorize_claim_recipient`.
7. **FINDING-10 (P2):** Two-step governance rotation.
8. **FINDING-5 (P2):** FIFO + delay invariant on `process_redemption_queue`; configured treasury recipient on `withdraw_pool_treasury_*`.

Findings 4 and 7 are clean — no action required.

---

## Verbatim Codex output

The complete, unedited Codex JSONL stream lives in this conversation's task output. Below is the parsed `agent_message` block (the report Codex produced) preserved verbatim, line-for-line, for audit:

```
### PROPERTY-1: Fee-vault account binding integrity
- **Status:** DOES_NOT_HOLD
- **Severity (if not HOLDS):** P1 (fee leakage / mis-routing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:3514-3515, 3813-3827, 3961-3962, 4009-4010
- **Pre-conditions:** A caller supplies optional fee-vault accounts during premium/deposit/settlement/redemption flows.
- **Concrete evidence:** The optional `protocol_fee_vault`, `pool_treasury_vault`, `pool_oracle_fee_vault`, and `pool_oracle_policy` fields are only `#[account(mut)]` / plain optional accounts in the `#[derive(Accounts)]` structs. Runtime checks exist at lines 976-986, 1651-1687, 1978-1988, and 2147-2158, but the account resolver does not enforce canonical PDA seeds for these optional vaults.
- **Impact:** Wrong-domain/mint is mostly rejected in handlers, but canonical account binding is not enforced at account-resolution time. Oracle-fee routing is especially exposed because the supplied oracle fee vault is not bound to the adjudicator.
- **Recommended fix:** Add seeds/constraints directly on optional accounts, e.g. `seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()]`; `seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()]`; and for oracle fees bind `SEED_POOL_ORACLE_FEE_VAULT` to the expected oracle plus mint.

### PROPERTY-2: Withdraw-rail account isolation
- **Status:** PARTIAL
- **Severity (if not HOLDS):** P1 (fee leakage / mis-routing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:4073-4075, 4131-4133, 4198-4200, 2277-2284, 2356-2363, 2435-2442
- **Pre-conditions:** Governance, pool curator, oracle wallet/admin, or a compromised privileged signer calls a withdraw instruction.
- **Concrete evidence:** SPL withdraw recipient token accounts are mutable `InterfaceAccount<TokenAccount>` with no owner constraint. `transfer_from_domain_vault` checks mint and self-transfer only at lines 6899-6923. Balance safety holds via `require_fee_vault_balance` using checked `withdrawn + requested <= accrued` at lines 6833-6840. Cross-rail confusion is mostly blocked by distinct account types, PDA seeds, and SOL/SPL rail constraints at lines 4050-4056, 4108-4114, 4174-4181.
- **Impact:** A privileged or mistaken caller can send accrued fees to any token account of the correct mint.
- **Recommended fix:** Add recipient-owner constraints, e.g. `constraint = recipient_token_account.owner == authority.key() @ OmegaXProtocolError::Unauthorized`, or add configured fee recipient fields per vault and require `recipient_token_account.owner == vault.configured_recipient`.

### PROPERTY-3: Oracle fee accrual binding
- **Status:** DOES_NOT_HOLD
- **Severity (if not HOLDS):** P1 (fee leakage / mis-routing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:1672-1687, 3815-3827, 5022-5031
- **Pre-conditions:** Claim settlement supplies both `pool_oracle_fee_vault` and `pool_oracle_policy`.
- **Concrete evidence:** Settlement checks only `vault.asset_mint == funding_line.asset_mint` and `vault.liquidity_pool == policy.liquidity_pool`. `PoolOraclePolicy` stores only `liquidity_pool` and fee settings, not oracle or asset. There is no `vault.oracle == claim_case.adjudicator` check.
- **Impact:** A valid fee vault for another oracle on the same pool/asset can receive the adjudicator fee.
- **Recommended fix:** Add `require_keys_eq!(vault.oracle, ctx.accounts.claim_case.adjudicator, OmegaXProtocolError::OracleProfileMismatch);` and constrain the optional account with seeds including that expected oracle.

### PROPERTY-4: PDA seed canonicality + init re-init protection
PROPERTY-4: HOLDS — defense is governance-only handlers plus canonical `init` PDA seeds for protocol, pool treasury, and pool oracle fee vaults at programs/omegax_protocol/src/lib.rs:344-366, 384-410, 429-462, 3206-3213, 3237-3244, 3283-3290.

### PROPERTY-5: Curator authority scope
- **Status:** PARTIAL
- **Severity (if not HOLDS):** P2 (DoS / griefing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:2122-2126, 2223-2226, 2345-2349, 6579-6588
- **Pre-conditions:** Pool curator or governance signs redemption processing or pool-treasury withdrawal.
- **Concrete evidence:** Redemption recipient is pinned to `lp_position.owner` at lines 2223-2226, so curator cannot redirect LP payouts. However `require_curator_control` is only curator-or-governance, and there is no processing timelock, multisig, FIFO queue invariant, or destination owner constraint for treasury withdrawals.
- **Impact:** LP payout routing is protected, but curator discretion over redemption timing/order and pool-treasury withdrawals remains broad.
- **Recommended fix:** Add queue ordering/timelock or multisig policy for `process_redemption_queue`, and constrain pool-treasury recipient ownership or configured treasury recipient.

### PROPERTY-6: Token program / mint extension safety
- **Status:** DOES_NOT_HOLD
- **Severity (if not HOLDS):** P1 (fee leakage / mis-routing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:6, 3518-3521, 3837-3848, 3965-3968, 4023-4024, 6784-6788, 6941-6945
- **Pre-conditions:** A Token-2022 mint or token account is used for an asset rail.
- **Concrete evidence:** The program uses `anchor_spl::token_interface` with `InterfaceAccount<Mint>`, `InterfaceAccount<TokenAccount>`, and `Interface<TokenInterface>`, so both SPL Token and Token-2022 are accepted. There is no mint owner constraint excluding Token-2022 or extension inspection. Several flows perform CPI before final accounting, including deposits at 1957-1965 before state updates and fee withdrawals at 2277-2287 before `withdrawn_fees` is updated.
- **Impact:** Token-2022 transfer fees/hooks can break exact accounting assumptions or create reentrancy-sensitive windows.
- **Recommended fix:** For mainnet launch, either require classic SPL Token with `constraint = asset_mint.to_account_info().owner == &anchor_spl::token::ID` and `constraint = token_program.key() == anchor_spl::token::ID`, or explicitly inspect and forbid unsafe Token-2022 extensions and move all state updates before CPI with a reentrancy guard.

### PROPERTY-7: SOL-rail lamport accounting
PROPERTY-7: HOLDS — defense is checked `withdrawn + requested <= accrued` at programs/omegax_protocol/src/lib.rs:6833-6840 plus post-transfer rent preservation in `transfer_lamports_from_fee_vault` at lines 6861-6869.

### PROPERTY-8: Settlement recipient routing under delegate_recipient
- **Status:** PARTIAL
- **Severity (if not HOLDS):** P2 (DoS / griefing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:1512-1522, 3698-3720, 6480-6488
- **Pre-conditions:** Member signs `authorize_claim_recipient` after claim approval but before settlement.
- **Concrete evidence:** Only the member can set the delegate because `member_position.wallet == authority.key()` and `claim_case.member_position == member_position.key()`. But the handler has no status gate, paid-amount gate, or approval-time recipient snapshot, so it can run between approval and settlement.
- **Impact:** Payout recipient can change after approval, which may violate approval/review assumptions.
- **Recommended fix:** Add `require!(claim_case.intake_status < CLAIM_INTAKE_APPROVED && claim_case.paid_amount == 0, OmegaXProtocolError::ClaimRecipientLocked);` or snapshot/freeze `settlement_recipient` during adjudication.

### PROPERTY-9: Capital-class deposit access boundary
- **Status:** DOES_NOT_HOLD
- **Severity (if not HOLDS):** P0 (fund-loss path)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:1947-2015, 2083-2087, 2064-2067
- **Pre-conditions:** Capital class is `OPEN`, `min_lockup_seconds == 0` or already elapsed, and redemption can be processed by curator/governance.
- **Concrete evidence:** Deposits have no signer-role gate, open access is allowed at lines 2008-2011, and caller-supplied `args.shares` is honored verbatim at lines 1995-2000. Redemption value is later computed pro-rata from `capital_class.total_shares` and `nav_assets` at lines 2083-2087. There is no NAV snapshot or deposit-to-redeem delay beyond optional lockup.
- **Impact:** A dust depositor can mint mispriced shares, then redeem against existing NAV if the pool is open and lockup is zero/short.
- **Recommended fix:** Ignore caller-supplied shares for open deposits and compute `shares = amount * total_shares / nav_assets` when supply exists; enforce nonzero settlement delay/snapshot epochs before redemption eligibility.

### PROPERTY-10: Authority rotation
- **Status:** DOES_NOT_HOLD
- **Severity (if not HOLDS):** P2 (DoS / griefing)
- **File:line(s):** programs/omegax_protocol/src/lib.rs:217-229, 3097-3100, 6010-6022
- **Pre-conditions:** Current governance signs rotation to a typo, dead key, or inaccessible key.
- **Concrete evidence:** Rotation immediately writes `governance.governance_authority = new_governance_authority`; only zero pubkey is rejected. There is no pending authority, accept step, timeout, cancel, or recovery path in the account.
- **Impact:** A bad rotation can brick governance-controlled protocol operations.
- **Recommended fix:** Replace direct rotation with two-step `pending_governance_authority` + `accept_protocol_governance_authority`; allow current authority to cancel before acceptance and consider a time-limited emergency recovery policy.

- **VERDICT:** MUST-FIX-BEFORE-MAINNET
- **TOTALS:** P0=1 P1=4 P2=3 P3=0
```

---

## How this report was generated

```bash
# v0.125.0 codex CLI; defensive-audit framing (offensive framing was filtered by OpenAI safety)
codex exec - \
  -C /Users/dr_sabijan/Documents/GitHub/omegax-protocol \
  -s read-only \
  -c 'model_reasoning_effort="high"' \
  --json \
  < /tmp/codex-prompt.txt
```

Prompt source: this conversation's `gstack-codex` skill invocation, reframed as a defensive pre-mainnet audit of 10 named safety properties. Each finding includes file:line evidence and a concrete remediation sketch.

**Tokens:** 1,038,311. **Wall clock:** ~4 min. **Exit:** 0.

## Cross-reference

- Prior pen-test (PT-01..PT-13): [`pre-mainnet-pen-test-2026-04-27.md`](pre-mainnet-pen-test-2026-04-27.md)
- Privileged-role custody matrix: [`mainnet-privileged-role-controls.md`](mainnet-privileged-role-controls.md)
- Phase 1.6 fee-rail accrual: PR #23 (merged commits `9cee4ef`, `6634f79`, `956d0f1`, `8bf2849`, `7171866`, `42dba41`)
- Phase 1.7 fee-rail withdrawals + frontend: PR #23 (final) + commit `c026348`, `576819a`
