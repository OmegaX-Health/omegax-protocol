// SPDX-License-Identifier: AGPL-3.0-or-later

//! MagicBlock adjunct program for private claim-review sessions.
//!
//! This program intentionally stores only public-safe hashes and session state.
//! Raw medical evidence, encrypted evidence payloads, OCR text, storage paths,
//! and payout details stay outside this program.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

declare_id!("FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn");

pub const SEED_REVIEW_SESSION: &[u8] = b"private_claim_review";
pub const MAX_SESSION_ID_LEN: usize = 64;
pub const MAGICBLOCK_DEVNET_TEE_VALIDATOR: Pubkey = Pubkey::new_from_array([
    5, 61, 71, 26, 133, 158, 115, 46, 104, 11, 201, 88, 248, 65, 7, 43, 143, 63, 188, 25, 115, 155,
    230, 151, 196, 198, 129, 18, 111, 140, 31, 116,
]);

pub const REVIEW_STATUS_OPENED: u8 = 0;
pub const REVIEW_STATUS_DELEGATED: u8 = 1;
pub const REVIEW_STATUS_REVIEWED: u8 = 2;
pub const REVIEW_STATUS_APPROVED: u8 = 3;
pub const REVIEW_STATUS_NEEDS_MORE_INFO: u8 = 4;
pub const REVIEW_STATUS_ESCALATED: u8 = 5;
pub const REVIEW_STATUS_FAILED: u8 = 6;

#[ephemeral]
#[program]
pub mod omegax_private_claim_review {
    use super::*;

    pub fn open_review_session(
        ctx: Context<OpenReviewSession>,
        args: OpenReviewSessionArgs,
    ) -> Result<()> {
        require!(
            !args.session_id.trim().is_empty(),
            PrivateClaimReviewError::EmptySessionId
        );
        require!(
            args.session_id.len() <= MAX_SESSION_ID_LEN,
            PrivateClaimReviewError::SessionIdTooLong
        );
        require!(
            !is_zero_hash(&args.evidence_ref_hash),
            PrivateClaimReviewError::ZeroEvidenceRefHash
        );
        require!(
            !is_zero_hash(&args.schema_key_hash),
            PrivateClaimReviewError::ZeroSchemaKeyHash
        );
        require!(
            !is_zero_hash(&args.schema_hash),
            PrivateClaimReviewError::ZeroSchemaHash
        );

        let now_ts = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.review_session;
        session.session_id = args.session_id;
        session.claim_case = args.claim_case;
        session.health_plan = args.health_plan;
        session.policy_series = args.policy_series;
        session.evidence_ref_hash = args.evidence_ref_hash;
        session.decision_support_hash = args.decision_support_hash;
        session.schema_key_hash = args.schema_key_hash;
        session.schema_hash = args.schema_hash;
        session.review_result_hash = [0; 32];
        session.review_artifact_hash = [0; 32];
        session.review_binary_hash = [0; 32];
        session.tee_attestation_digest = [0; 32];
        session.operator = Pubkey::default();
        session.private_payment_ref_hash = [0; 32];
        session.status = REVIEW_STATUS_OPENED;
        session.opened_at = now_ts;
        session.delegated_at = 0;
        session.reviewed_at = 0;
        session.payment_recorded_at = 0;
        session.committed_at = 0;
        session.failed_at = 0;
        session.bump = ctx.bumps.review_session;

        emit!(ReviewSessionOpened {
            review_session: session.key(),
            claim_case: session.claim_case,
            evidence_ref_hash: session.evidence_ref_hash,
            schema_key_hash: session.schema_key_hash,
        });

        Ok(())
    }

    pub fn delegate_review_session(
        ctx: Context<DelegateReviewSession>,
        session_id: String,
    ) -> Result<()> {
        require!(
            !session_id.trim().is_empty(),
            PrivateClaimReviewError::EmptySessionId
        );
        require!(
            session_id.len() <= MAX_SESSION_ID_LEN,
            PrivateClaimReviewError::SessionIdTooLong
        );

        ctx.accounts.delegate_review_session(
            &ctx.accounts.payer,
            &[SEED_REVIEW_SESSION, session_id.as_bytes()],
            DelegateConfig {
                validator: Some(MAGICBLOCK_DEVNET_TEE_VALIDATOR),
                ..DelegateConfig::default()
            },
        )?;

        emit!(ReviewSessionDelegated {
            review_session: ctx.accounts.review_session.key(),
        });

        Ok(())
    }

    pub fn record_private_review(
        ctx: Context<RecordPrivateReview>,
        args: RecordPrivateReviewArgs,
    ) -> Result<()> {
        require!(
            is_terminal_review_status(args.status),
            PrivateClaimReviewError::InvalidReviewStatus
        );
        require!(
            !is_zero_hash(&args.review_result_hash),
            PrivateClaimReviewError::ZeroReviewResultHash
        );
        require!(
            !is_zero_hash(&args.review_artifact_hash),
            PrivateClaimReviewError::ZeroReviewArtifactHash
        );
        require!(
            !is_zero_hash(&args.review_binary_hash),
            PrivateClaimReviewError::ZeroReviewBinaryHash
        );
        require!(
            !is_zero_hash(&args.tee_attestation_digest),
            PrivateClaimReviewError::ZeroTeeAttestationDigest
        );

        let session = &mut ctx.accounts.review_session;
        require!(
            session.status == REVIEW_STATUS_OPENED || session.status == REVIEW_STATUS_DELEGATED,
            PrivateClaimReviewError::ReviewNotWritable
        );
        require!(
            is_zero_hash(&session.review_result_hash),
            PrivateClaimReviewError::ReviewAlreadyRecorded
        );

        let now_ts = Clock::get()?.unix_timestamp;
        session.review_result_hash = args.review_result_hash;
        session.review_artifact_hash = args.review_artifact_hash;
        session.review_binary_hash = args.review_binary_hash;
        session.tee_attestation_digest = args.tee_attestation_digest;
        session.operator = ctx.accounts.reviewer.key();
        session.status = args.status;
        session.reviewed_at = now_ts;

        emit!(PrivateReviewRecorded {
            review_session: session.key(),
            operator: session.operator,
            status: session.status,
            review_result_hash: session.review_result_hash,
            review_artifact_hash: session.review_artifact_hash,
        });

        Ok(())
    }

    pub fn record_private_payment_ref(
        ctx: Context<RecordPrivatePaymentRef>,
        args: RecordPrivatePaymentRefArgs,
    ) -> Result<()> {
        require!(
            !is_zero_hash(&args.private_payment_ref_hash),
            PrivateClaimReviewError::ZeroPrivatePaymentRefHash
        );

        let session = &mut ctx.accounts.review_session;
        require!(
            session.status == REVIEW_STATUS_APPROVED || session.status == REVIEW_STATUS_REVIEWED,
            PrivateClaimReviewError::PaymentRefNotAllowed
        );
        require!(
            is_zero_hash(&session.private_payment_ref_hash),
            PrivateClaimReviewError::PaymentRefAlreadyRecorded
        );

        session.private_payment_ref_hash = args.private_payment_ref_hash;
        session.payment_recorded_at = Clock::get()?.unix_timestamp;

        emit!(PrivatePaymentRefRecorded {
            review_session: session.key(),
            private_payment_ref_hash: session.private_payment_ref_hash,
        });

        Ok(())
    }

    pub fn commit_and_close_review_session(
        ctx: Context<CommitAndCloseReviewSession>,
    ) -> Result<()> {
        let session = &mut ctx.accounts.review_session;
        require!(
            session.status == REVIEW_STATUS_REVIEWED
                || session.status == REVIEW_STATUS_APPROVED
                || session.status == REVIEW_STATUS_NEEDS_MORE_INFO
                || session.status == REVIEW_STATUS_ESCALATED
                || session.status == REVIEW_STATUS_FAILED,
            PrivateClaimReviewError::ReviewNotReadyToCommit
        );
        session.committed_at = Clock::get()?.unix_timestamp;

        emit!(ReviewSessionCommitted {
            review_session: session.key(),
            status: session.status,
            review_artifact_hash: session.review_artifact_hash,
            private_payment_ref_hash: session.private_payment_ref_hash,
        });

        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.review_session.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        Ok(())
    }

    pub fn mark_review_failed(
        ctx: Context<MarkReviewFailed>,
        args: MarkReviewFailedArgs,
    ) -> Result<()> {
        require!(
            !is_zero_hash(&args.failure_ref_hash),
            PrivateClaimReviewError::ZeroFailureRefHash
        );

        let session = &mut ctx.accounts.review_session;
        require!(
            session.status != REVIEW_STATUS_APPROVED,
            PrivateClaimReviewError::ApprovedReviewCannotFail
        );
        session.review_artifact_hash = args.failure_ref_hash;
        session.status = REVIEW_STATUS_FAILED;
        session.failed_at = Clock::get()?.unix_timestamp;

        emit!(ReviewSessionFailed {
            review_session: session.key(),
            failure_ref_hash: session.review_artifact_hash,
        });

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct PrivateClaimReviewSession {
    #[max_len(MAX_SESSION_ID_LEN)]
    pub session_id: String,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub schema_hash: [u8; 32],
    pub review_result_hash: [u8; 32],
    pub review_artifact_hash: [u8; 32],
    pub review_binary_hash: [u8; 32],
    pub tee_attestation_digest: [u8; 32],
    pub operator: Pubkey,
    pub private_payment_ref_hash: [u8; 32],
    pub status: u8,
    pub opened_at: i64,
    pub delegated_at: i64,
    pub reviewed_at: i64,
    pub payment_recorded_at: i64,
    pub committed_at: i64,
    pub failed_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct OpenReviewSessionArgs {
    #[max_len(MAX_SESSION_ID_LEN)]
    pub session_id: String,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub schema_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecordPrivateReviewArgs {
    pub status: u8,
    pub review_result_hash: [u8; 32],
    pub review_artifact_hash: [u8; 32],
    pub review_binary_hash: [u8; 32],
    pub tee_attestation_digest: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecordPrivatePaymentRefArgs {
    pub private_payment_ref_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct MarkReviewFailedArgs {
    pub failure_ref_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: OpenReviewSessionArgs)]
pub struct OpenReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + PrivateClaimReviewSession::INIT_SPACE,
        seeds = [SEED_REVIEW_SESSION, args.session_id.as_bytes()],
        bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(session_id: String)]
pub struct DelegateReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The delegation program validates ownership and delegated state.
    #[account(
        mut,
        del,
        seeds = [SEED_REVIEW_SESSION, session_id.as_bytes()],
        bump,
    )]
    pub review_session: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(_args: RecordPrivateReviewArgs)]
pub struct RecordPrivateReview<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[derive(Accounts)]
#[instruction(_args: RecordPrivatePaymentRefArgs)]
pub struct RecordPrivatePaymentRef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitAndCloseReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[derive(Accounts)]
#[instruction(_args: MarkReviewFailedArgs)]
pub struct MarkReviewFailed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_SESSION, review_session.session_id.as_bytes()],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[event]
pub struct ReviewSessionOpened {
    pub review_session: Pubkey,
    pub claim_case: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionDelegated {
    pub review_session: Pubkey,
}

#[event]
pub struct PrivateReviewRecorded {
    pub review_session: Pubkey,
    pub operator: Pubkey,
    pub status: u8,
    pub review_result_hash: [u8; 32],
    pub review_artifact_hash: [u8; 32],
}

#[event]
pub struct PrivatePaymentRefRecorded {
    pub review_session: Pubkey,
    pub private_payment_ref_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionCommitted {
    pub review_session: Pubkey,
    pub status: u8,
    pub review_artifact_hash: [u8; 32],
    pub private_payment_ref_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionFailed {
    pub review_session: Pubkey,
    pub failure_ref_hash: [u8; 32],
}

#[error_code]
pub enum PrivateClaimReviewError {
    #[msg("review session id is required")]
    EmptySessionId,
    #[msg("review session id exceeds the maximum length")]
    SessionIdTooLong,
    #[msg("evidence reference hash cannot be zero")]
    ZeroEvidenceRefHash,
    #[msg("schema key hash cannot be zero")]
    ZeroSchemaKeyHash,
    #[msg("schema hash cannot be zero")]
    ZeroSchemaHash,
    #[msg("review result hash cannot be zero")]
    ZeroReviewResultHash,
    #[msg("review artifact hash cannot be zero")]
    ZeroReviewArtifactHash,
    #[msg("review binary hash cannot be zero")]
    ZeroReviewBinaryHash,
    #[msg("TEE attestation digest cannot be zero")]
    ZeroTeeAttestationDigest,
    #[msg("private payment reference hash cannot be zero")]
    ZeroPrivatePaymentRefHash,
    #[msg("failure reference hash cannot be zero")]
    ZeroFailureRefHash,
    #[msg("invalid private review status")]
    InvalidReviewStatus,
    #[msg("private review is not writable in its current state")]
    ReviewNotWritable,
    #[msg("private review result already recorded")]
    ReviewAlreadyRecorded,
    #[msg("private payment reference cannot be recorded in the current state")]
    PaymentRefNotAllowed,
    #[msg("private payment reference already recorded")]
    PaymentRefAlreadyRecorded,
    #[msg("private review session is not ready to commit")]
    ReviewNotReadyToCommit,
    #[msg("approved private review cannot be marked failed")]
    ApprovedReviewCannotFail,
}

fn is_zero_hash(hash: &[u8; 32]) -> bool {
    hash.iter().all(|byte| *byte == 0)
}

fn is_terminal_review_status(status: u8) -> bool {
    status == REVIEW_STATUS_REVIEWED
        || status == REVIEW_STATUS_APPROVED
        || status == REVIEW_STATUS_NEEDS_MORE_INFO
        || status == REVIEW_STATUS_ESCALATED
        || status == REVIEW_STATUS_FAILED
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_hash_detection_is_exact() {
        assert!(is_zero_hash(&[0; 32]));
        let mut hash = [0; 32];
        hash[31] = 1;
        assert!(!is_zero_hash(&hash));
    }

    #[test]
    fn only_review_terminal_statuses_can_be_recorded() {
        assert!(!is_terminal_review_status(REVIEW_STATUS_OPENED));
        assert!(!is_terminal_review_status(REVIEW_STATUS_DELEGATED));
        assert!(is_terminal_review_status(REVIEW_STATUS_REVIEWED));
        assert!(is_terminal_review_status(REVIEW_STATUS_APPROVED));
        assert!(is_terminal_review_status(REVIEW_STATUS_NEEDS_MORE_INFO));
        assert!(is_terminal_review_status(REVIEW_STATUS_ESCALATED));
        assert!(is_terminal_review_status(REVIEW_STATUS_FAILED));
    }
}
