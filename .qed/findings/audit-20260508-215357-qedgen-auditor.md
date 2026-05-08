# QEDGen Auditor Report - 2026-05-08 21:53:57 MYT

## Digest

- Mode: `qedgen-auditor` skill; spec-aware for `omegax_protocol.qedspec`, spec-less/source audit for `omegax_private_claim_review`.
- Runtime: Anchor.
- Checkout: `main...origin/main [ahead 11, behind 3]` at audit start; no unstaged files before audit artifacts were created.
- Real findings: 0 critical, 0 high, 2 medium.
- Spec gaps: 2.
- Suppressed or accepted false positives: 1 existing suppression.
- Silent repro count: 0. No critical/high finding survived escalation, so no Mollusk repro was required.

## Commands

- `qedgen probe --spec omegax_protocol.qedspec`
  - Result: spec-aware mode, `findings: []`.
- `qedgen probe --bootstrap --root .`
  - Result: detected 76 handlers including the new MagicBlock adjunct; `findings: []`.
- `npm run qedgen:check`
  - Result: passed with `193 info`, `1 warnings`, `0 errors`.
  - Accepted warning: `missing_cpi_for_token_context` on `create_domain_asset_vault`.
- `qedgen check --spec omegax_protocol.qedspec --anchor-project programs/omegax_protocol --coverage --json`
  - Result: nonzero because property/theorem coverage obligations remain; handler coverage drift is empty.
- `qedgen verify --probe-repros --json`
  - Result: no repros found; no critical/high repros were required.
- `qedgen spec --idl target/idl/omegax_private_claim_review.json`
  - Result: scaffolded `formal_verification/omegax_private_claim_review.qedspec`.
- `cargo test -p omegax_private_claim_review --lib`
  - Result: passed, 3 tests.
- `npm run test:node -- --test-name-pattern MagicBlock`
  - Result: passed, 278 tests. Node's test runner still enumerated the suite; all tests passed.

## [MEDIUM] `record_private_review` - Unbound Reviewer Can Forge A Terminal Private Review

**Location:** `programs/omegax_private_claim_review/src/lib.rs:125`
**Mode:** spec-less adjunct audit.
**Runtime:** Anchor / MagicBlock ER adjunct.
**Standalone severity:** MEDIUM.
**Kill-chain:** unbound reviewer signer + open/delegated session writability = forged MagicBlock proof state.

### Vulnerable Code

```rust
125 pub fn record_private_review(
126     ctx: Context<RecordPrivateReview>,
127     args: RecordPrivateReviewArgs,
...
150     let session = &mut ctx.accounts.review_session;
151     require!(
152         session.status == REVIEW_STATUS_OPENED || session.status == REVIEW_STATUS_DELEGATED,
153         PrivateClaimReviewError::ReviewNotWritable
154     );
...
161     session.review_result_hash = args.review_result_hash;
162     session.review_artifact_hash = args.review_artifact_hash;
163     session.review_binary_hash = args.review_binary_hash;
164     session.tee_attestation_digest = args.tee_attestation_digest;
165     session.operator = ctx.accounts.reviewer.key();
166     session.status = args.status;
```

```rust
360 #[derive(Accounts)]
361 #[instruction(_args: RecordPrivateReviewArgs)]
362 pub struct RecordPrivateReview<'info> {
363     #[account(mut)]
364     pub reviewer: Signer<'info>,
365     #[account(
366         mut,
367         seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
368         bump = review_session.bump,
369     )]
370     pub review_session: Account<'info, PrivateClaimReviewSession>,
371 }
```

### Attack Scenario

Any signer can call `record_private_review` for any open review-session PDA they can address. The handler accepts `REVIEW_STATUS_OPENED`, not only delegated sessions, and stores arbitrary nonzero result/artifact/binary/TEE hashes while setting `operator` to the caller. A front-runner can therefore make a session look `APPROVED`, `REVIEWED`, `NEEDS_MORE_INFO`, `ESCALATED`, or `FAILED` without being a MagicBlock operator, a selected reviewer, or an attested TEE key.

This does not directly drain the main `omegax_protocol` reserve: `attest_claim_case` still requires an actual registered oracle signer, schema support, and funding-line bindings. The impact is the integrity of the MagicBlock adjunct proof layer. If `omegax-health` or demo automation treats this session as proof that a private review occurred, the public "private evidence in, public proof out" story can be forged by a normal wallet.

### Composes With

- `delegate_review_session` does not update `status` or `delegated_at`, so the program cannot distinguish an actually delegated account from an opened session in its own state.
- Off-chain bridge automation that calls `attest_claim_case` after seeing an approved adjunct session can promote this from adjunct-state forgery into a false operational attestation.
- `mark_review_failed` is also unbound, so attackers can either forge success or force failure depending on timing.

### Proposed Fix

Add an explicit review authority/selected operator binding and require it in the review instruction. The safest hackathon-sized shape:

```rust
pub struct PrivateClaimReviewSession {
    pub opener: Pubkey,
    pub expected_reviewer: Pubkey,
    // existing fields...
}

require_keys_eq!(
    ctx.accounts.reviewer.key(),
    session.expected_reviewer,
    PrivateClaimReviewError::UnauthorizedReviewer
);
require!(
    session.status == REVIEW_STATUS_DELEGATED,
    PrivateClaimReviewError::ReviewNotWritable
);
```

Then make `delegate_review_session` mark the session delegated and set `delegated_at`, or add a separate base-layer `mark_delegated` step that is callable only by the opener/expected reviewer after the MagicBlock delegate transaction succeeds. For production, replace `expected_reviewer` with a registry/attested-operator PDA or a session key derived from the TEE attestation document.

### Proposed Spec

Complete the scaffolded `formal_verification/omegax_private_claim_review.qedspec` with guards equivalent to:

```text
handler record_private_review {
  auth reviewer
  requires state.status == delegated else ReviewNotWritable
  requires reviewer == state.expected_reviewer else UnauthorizedReviewer
  requires state.review_result_hash == 0 else ReviewAlreadyRecorded
  effect state.status := args.status
  effect state.operator := reviewer
}
```

## [MEDIUM] `mark_review_failed` - Any Payer Can Fail Someone Else's Session

**Location:** `programs/omegax_private_claim_review/src/lib.rs:241`
**Mode:** spec-less adjunct audit.
**Runtime:** Anchor / MagicBlock ER adjunct.
**Standalone severity:** MEDIUM.
**Kill-chain:** unbound payer signer + mutable review-session PDA = permissionless griefing of private review sessions.

### Vulnerable Code

```rust
241 pub fn mark_review_failed(
242     ctx: Context<MarkReviewFailed>,
243     args: MarkReviewFailedArgs,
...
250     let session = &mut ctx.accounts.review_session;
251     require!(
252         session.status != REVIEW_STATUS_APPROVED,
253         PrivateClaimReviewError::ApprovedReviewCannotFail
254     );
255     session.review_artifact_hash = args.failure_ref_hash;
256     session.status = REVIEW_STATUS_FAILED;
257     session.failed_at = Clock::get()?.unix_timestamp;
```

```rust
399 #[derive(Accounts)]
400 #[instruction(_args: MarkReviewFailedArgs)]
401 pub struct MarkReviewFailed<'info> {
402     #[account(mut)]
403     pub payer: Signer<'info>,
404     #[account(
405         mut,
406         seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
407         bump = review_session.bump,
408     )]
409     pub review_session: Account<'info, PrivateClaimReviewSession>,
410 }
```

### Attack Scenario

Any signer can mark any non-approved session failed. That includes sessions that are still opened, delegated, reviewed, already failed, needs-more-info, or escalated. A third party can grief the claim-room proof trail by writing an arbitrary failure hash and terminal failure state before the real reviewer records the outcome.

This is bounded to the adjunct proof layer, so it is not a direct money-out vulnerability. It does, however, break demo correctness and any future workflow that treats `FAILED` as an authoritative private-review state.

### Composes With

- The same missing reviewer binding as `record_private_review`; attackers can race success or failure paths.
- Lack of one-shot terminal transition restrictions; several terminal-ish states can still be overwritten into `FAILED`.

### Proposed Fix

Require the same session authority/expected reviewer used for `record_private_review`, and narrow the lifecycle:

```rust
require_keys_eq!(
    ctx.accounts.payer.key(),
    session.expected_reviewer,
    PrivateClaimReviewError::UnauthorizedReviewer
);
require!(
    session.status == REVIEW_STATUS_OPENED || session.status == REVIEW_STATUS_DELEGATED,
    PrivateClaimReviewError::ReviewNotWritable
);
require!(
    is_zero_hash(&session.review_result_hash),
    PrivateClaimReviewError::ReviewAlreadyRecorded
);
```

Alternatively, delete `mark_review_failed` and represent failure through `record_private_review` with `REVIEW_STATUS_FAILED`, so every terminal review outcome goes through one authority gate.

### Proposed Spec

```text
handler mark_review_failed {
  auth reviewer
  requires reviewer == state.expected_reviewer else UnauthorizedReviewer
  requires state.status in {opened, delegated} else ReviewNotWritable
  requires state.review_result_hash == 0 else ReviewAlreadyRecorded
  effect state.status := failed
}
```

## Spec Gap: MagicBlock Adjunct Has Only A Scaffolded Spec

Status: verification coverage gap.

`formal_verification/omegax_private_claim_review.qedspec` was generated from the Anchor IDL during this audit. It is scaffold-only: hash fields are abstracted as `U64`, handlers still contain TODO guards/effects, and the reviewer/delegation authority model is not represented yet.

Recommended next edit:

- Add explicit state fields for opener/session authority and expected reviewer/operator.
- Model status transitions: `opened -> delegated -> reviewed/approved/needs_more_info/escalated/failed -> committed`.
- Add one-shot guards for review result and private payment reference.
- Add a property that terminal review result hashes cannot be written by an unbound signer.

## Spec Gap: Main Protocol Spec Passes, But Property Coverage Remains Mostly Informational

Status: verification hygiene gap.

`qedgen check --coverage --json` now reports no handler coverage drift for `omegax_protocol.qedspec`, including the previous governance handoff gap. The remaining nonzero status is property/theorem coverage and many write-without-read/unused-field info docs. That is acceptable for this audit, but it means "QEDGen passes" should still be described as a current gate plus selected properties, not as comprehensive proof of the whole protocol.

Recommended next edit:

- Keep `npm run qedgen:check` as the public gate.
- Add focused properties for the new MagicBlock adjunct once the authority guards are implemented.
- Keep the one accepted `create_domain_asset_vault` warning documented in `.qed/probe-suppress.toml`.

## Suppressed / Accepted

- Existing accepted warning: `missing_cpi_for_token_context` on `create_domain_asset_vault`. The token program is used for Anchor token-account initialization only; no SPL transfer occurs in that handler.

## Scaffolded

- `formal_verification/omegax_private_claim_review.qedspec`
- `.qed/findings/audit-20260508-215357-qedgen-auditor.md`

## Bottom Line

The main settlement kernel did not produce a new critical/high finding in this pass. The new MagicBlock adjunct needs an authority model before it should be treated as a proof of private review: today, ordinary wallets can forge or fail the review-session state.
