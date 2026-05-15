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

use crate::program::OmegaxPrivateClaimReview;

declare_id!("FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn");

pub const SEED_REVIEW_REGISTRY: &[u8] = b"private_review_registry";
pub const SEED_REVIEW_OPERATOR: &[u8] = b"private_review_operator";
pub const SEED_REVIEW_SESSION: &[u8] = b"private_claim_review";
pub const MAX_SESSION_ID_LEN: usize = 32;
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

    pub fn initialize_review_registry(
        ctx: Context<InitializeReviewRegistry>,
        args: InitializeReviewRegistryArgs,
    ) -> Result<()> {
        require_not_default_pubkey(
            args.session_authority,
            PrivateClaimReviewError::InvalidSessionAuthority,
        )?;
        require_not_default_pubkey(
            args.payment_attestor,
            PrivateClaimReviewError::InvalidPaymentAttestor,
        )?;

        let now_ts = Clock::get()?.unix_timestamp;
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.session_authority = args.session_authority;
        registry.payment_attestor = args.payment_attestor;
        registry.active = args.active;
        registry.operator_count = 0;
        registry.created_at = now_ts;
        registry.updated_at = now_ts;
        registry.bump = ctx.bumps.registry;

        emit!(ReviewRegistryInitialized {
            registry: registry.key(),
            authority: registry.authority,
            session_authority: registry.session_authority,
            payment_attestor: registry.payment_attestor,
            active: registry.active,
        });

        Ok(())
    }

    pub fn set_review_registry_authority(
        ctx: Context<SetReviewRegistryAuthority>,
        args: SetReviewRegistryAuthorityArgs,
    ) -> Result<()> {
        require_not_default_pubkey(
            args.new_authority,
            PrivateClaimReviewError::InvalidRegistryAuthority,
        )?;

        let registry = &mut ctx.accounts.registry;
        registry.authority = args.new_authority;
        registry.updated_at = Clock::get()?.unix_timestamp;

        emit!(ReviewRegistryAuthoritySet {
            registry: registry.key(),
            authority: registry.authority,
        });

        Ok(())
    }

    pub fn upsert_review_operator(
        ctx: Context<UpsertReviewOperator>,
        args: UpsertReviewOperatorArgs,
    ) -> Result<()> {
        require_not_default_pubkey(
            args.reviewer_authority,
            PrivateClaimReviewError::InvalidReviewerAuthority,
        )?;
        require!(
            !is_zero_hash(&args.review_binary_hash),
            PrivateClaimReviewError::ZeroReviewBinaryHash
        );

        let now_ts = Clock::get()?.unix_timestamp;
        let operator = &mut ctx.accounts.operator;
        let is_new_operator = operator.created_at == 0;
        operator.registry = ctx.accounts.registry.key();
        operator.reviewer_authority = args.reviewer_authority;
        operator.review_binary_hash = args.review_binary_hash;
        operator.active = args.active;
        if is_new_operator {
            operator.created_at = now_ts;
            operator.bump = ctx.bumps.operator;
            ctx.accounts.registry.operator_count =
                ctx.accounts.registry.operator_count.saturating_add(1);
        }
        operator.updated_at = now_ts;
        ctx.accounts.registry.updated_at = now_ts;

        emit!(ReviewOperatorUpserted {
            operator: operator.key(),
            registry: operator.registry,
            reviewer_authority: operator.reviewer_authority,
            review_binary_hash: operator.review_binary_hash,
            active: operator.active,
        });

        Ok(())
    }

    pub fn set_review_operator_active(
        ctx: Context<SetReviewOperatorActive>,
        active: bool,
    ) -> Result<()> {
        let now_ts = Clock::get()?.unix_timestamp;
        ctx.accounts.operator.active = active;
        ctx.accounts.operator.updated_at = now_ts;
        ctx.accounts.registry.updated_at = now_ts;

        emit!(ReviewOperatorActiveSet {
            operator: ctx.accounts.operator.key(),
            active,
        });

        Ok(())
    }

    pub fn open_review_session(
        ctx: Context<OpenReviewSession>,
        args: OpenReviewSessionArgs,
    ) -> Result<()> {
        require_canonical_session_id(&args.session_id)?;
        require_not_default_pubkey(args.claim_case, PrivateClaimReviewError::InvalidClaimCase)?;
        require_not_default_pubkey(args.health_plan, PrivateClaimReviewError::InvalidHealthPlan)?;
        require_not_default_pubkey(
            args.policy_series,
            PrivateClaimReviewError::InvalidPolicySeries,
        )?;
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
        session.session_authority = ctx.accounts.payer.key();
        session.claim_case = args.claim_case;
        session.health_plan = args.health_plan;
        session.policy_series = args.policy_series;
        session.evidence_ref_hash = args.evidence_ref_hash;
        session.decision_support_hash = args.decision_support_hash;
        session.schema_key_hash = args.schema_key_hash;
        session.schema_hash = args.schema_hash;
        session.review_operator = ctx.accounts.operator.key();
        session.reviewer_authority = ctx.accounts.operator.reviewer_authority;
        session.payment_attestor = ctx.accounts.registry.payment_attestor;
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
            session_authority: session.session_authority,
            review_operator: session.review_operator,
            reviewer_authority: session.reviewer_authority,
            claim_case: session.claim_case,
            evidence_ref_hash: session.evidence_ref_hash,
            schema_key_hash: session.schema_key_hash,
        });

        Ok(())
    }

    pub fn delegate_review_session(
        ctx: Context<DelegateReviewSession>,
        args: DelegateReviewSessionArgs,
    ) -> Result<()> {
        require_canonical_session_id(&args.session_id)?;

        let now_ts = Clock::get()?.unix_timestamp;
        let mut data = ctx.accounts.review_session.try_borrow_mut_data()?;
        let mut read_slice: &[u8] = &data[..];
        let mut session = PrivateClaimReviewSession::try_deserialize(&mut read_slice)?;
        require_keys_eq!(
            session.session_authority,
            ctx.accounts.payer.key(),
            PrivateClaimReviewError::UnauthorizedSessionAuthority
        );
        require_keys_eq!(
            session.claim_case,
            args.claim_case,
            PrivateClaimReviewError::InvalidClaimCase
        );
        require!(
            session.session_id == args.session_id,
            PrivateClaimReviewError::SessionIdMismatch
        );
        require!(
            session.status == REVIEW_STATUS_OPENED,
            PrivateClaimReviewError::ReviewNotDelegatable
        );
        session.status = REVIEW_STATUS_DELEGATED;
        session.delegated_at = now_ts;

        let session_authority = session.session_authority;
        let claim_case = session.claim_case;
        let session_id = session.session_id.clone();
        let mut write_slice: &mut [u8] = &mut data[..];
        session.try_serialize(&mut write_slice)?;
        drop(data);

        ctx.accounts.delegate_review_session(
            &ctx.accounts.payer,
            &[
                SEED_REVIEW_SESSION,
                session_authority.as_ref(),
                claim_case.as_ref(),
                session_id.as_bytes(),
            ],
            DelegateConfig {
                validator: Some(MAGICBLOCK_DEVNET_TEE_VALIDATOR),
                ..DelegateConfig::default()
            },
        )?;

        emit!(ReviewSessionDelegated {
            review_session: ctx.accounts.review_session.key(),
            session_authority,
            claim_case,
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
        require_keys_eq!(
            session.review_operator,
            ctx.accounts.operator.key(),
            PrivateClaimReviewError::UnauthorizedReviewOperator
        );
        require_keys_eq!(
            session.reviewer_authority,
            ctx.accounts.reviewer.key(),
            PrivateClaimReviewError::UnauthorizedReviewer
        );
        require_keys_eq!(
            session.payment_attestor,
            ctx.accounts.registry.payment_attestor,
            PrivateClaimReviewError::InvalidPaymentAttestor
        );
        require!(
            args.review_binary_hash == ctx.accounts.operator.review_binary_hash,
            PrivateClaimReviewError::ReviewBinaryHashMismatch
        );
        require!(
            session.status == REVIEW_STATUS_DELEGATED,
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
        require_keys_eq!(
            session.payment_attestor,
            ctx.accounts.payment_attestor.key(),
            PrivateClaimReviewError::UnauthorizedPaymentAttestor
        );
        require!(
            session.status == REVIEW_STATUS_APPROVED,
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
            payment_attestor: ctx.accounts.payment_attestor.key(),
            private_payment_ref_hash: session.private_payment_ref_hash,
        });

        Ok(())
    }

    pub fn commit_and_close_review_session(
        ctx: Context<CommitAndCloseReviewSession>,
    ) -> Result<()> {
        let session = &ctx.accounts.review_session;
        require_keys_eq!(
            session.session_authority,
            ctx.accounts.payer.key(),
            PrivateClaimReviewError::UnauthorizedSessionAuthority
        );
        require!(
            is_terminal_review_status(session.status),
            PrivateClaimReviewError::ReviewNotReadyToCommit
        );
        if session.status == REVIEW_STATUS_APPROVED {
            require!(
                !is_zero_hash(&session.private_payment_ref_hash),
                PrivateClaimReviewError::ApprovedReviewMissingPaymentRef
            );
        }
        require!(
            session.committed_at == 0,
            PrivateClaimReviewError::ReviewAlreadyCommitted
        );

        emit!(ReviewSessionCommitted {
            review_session: session.key(),
            session_authority: session.session_authority,
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

    pub fn finalize_committed_review_session(
        ctx: Context<FinalizeCommittedReviewSession>,
    ) -> Result<()> {
        let session = &mut ctx.accounts.review_session;
        require_keys_eq!(
            session.session_authority,
            ctx.accounts.payer.key(),
            PrivateClaimReviewError::UnauthorizedSessionAuthority
        );
        require!(
            is_terminal_review_status(session.status),
            PrivateClaimReviewError::ReviewNotReadyToCommit
        );
        if session.status == REVIEW_STATUS_APPROVED {
            require!(
                !is_zero_hash(&session.private_payment_ref_hash),
                PrivateClaimReviewError::ApprovedReviewMissingPaymentRef
            );
        }
        require!(
            session.committed_at == 0,
            PrivateClaimReviewError::ReviewAlreadyCommitted
        );

        session.committed_at = Clock::get()?.unix_timestamp;

        emit!(ReviewSessionCommitFinalized {
            review_session: session.key(),
            session_authority: session.session_authority,
            status: session.status,
            committed_at: session.committed_at,
        });

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
        let actor = ctx.accounts.actor.key();
        require!(
            actor == session.session_authority || actor == session.reviewer_authority,
            PrivateClaimReviewError::UnauthorizedFailureMarker
        );
        require!(
            session.status == REVIEW_STATUS_OPENED || session.status == REVIEW_STATUS_DELEGATED,
            PrivateClaimReviewError::TerminalReviewCannotFail
        );
        require!(
            session.committed_at == 0,
            PrivateClaimReviewError::ReviewAlreadyCommitted
        );
        session.review_artifact_hash = args.failure_ref_hash;
        session.status = REVIEW_STATUS_FAILED;
        session.failed_at = Clock::get()?.unix_timestamp;

        emit!(ReviewSessionFailed {
            review_session: session.key(),
            actor,
            failure_ref_hash: session.review_artifact_hash,
        });

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct PrivateReviewRegistry {
    pub authority: Pubkey,
    pub session_authority: Pubkey,
    pub payment_attestor: Pubkey,
    pub active: bool,
    pub operator_count: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PrivateReviewOperator {
    pub registry: Pubkey,
    pub reviewer_authority: Pubkey,
    pub review_binary_hash: [u8; 32],
    pub active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PrivateClaimReviewSession {
    #[max_len(MAX_SESSION_ID_LEN)]
    pub session_id: String,
    pub session_authority: Pubkey,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub schema_hash: [u8; 32],
    pub review_operator: Pubkey,
    pub reviewer_authority: Pubkey,
    pub payment_attestor: Pubkey,
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
pub struct InitializeReviewRegistryArgs {
    pub session_authority: Pubkey,
    pub payment_attestor: Pubkey,
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SetReviewRegistryAuthorityArgs {
    pub new_authority: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpsertReviewOperatorArgs {
    pub reviewer_authority: Pubkey,
    pub review_binary_hash: [u8; 32],
    pub active: bool,
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
pub struct DelegateReviewSessionArgs {
    #[max_len(MAX_SESSION_ID_LEN)]
    pub session_id: String,
    pub claim_case: Pubkey,
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
#[instruction(_args: InitializeReviewRegistryArgs)]
pub struct InitializeReviewRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + PrivateReviewRegistry::INIT_SPACE,
        seeds = [SEED_REVIEW_REGISTRY],
        bump,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ PrivateClaimReviewError::UnauthorizedRegistryInitializer
    )]
    pub program: Program<'info, OmegaxPrivateClaimReview>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ PrivateClaimReviewError::UnauthorizedRegistryInitializer
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_args: SetReviewRegistryAuthorityArgs)]
pub struct SetReviewRegistryAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.authority == authority.key() @ PrivateClaimReviewError::UnauthorizedRegistryAuthority,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
}

#[derive(Accounts)]
#[instruction(args: UpsertReviewOperatorArgs)]
pub struct UpsertReviewOperator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.authority == authority.key() @ PrivateClaimReviewError::UnauthorizedRegistryAuthority,
        constraint = registry.active @ PrivateClaimReviewError::RegistryInactive,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PrivateReviewOperator::INIT_SPACE,
        seeds = [SEED_REVIEW_OPERATOR, args.reviewer_authority.as_ref()],
        bump,
    )]
    pub operator: Account<'info, PrivateReviewOperator>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetReviewOperatorActive<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.authority == authority.key() @ PrivateClaimReviewError::UnauthorizedRegistryAuthority,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        mut,
        seeds = [SEED_REVIEW_OPERATOR, operator.reviewer_authority.as_ref()],
        bump = operator.bump,
        constraint = operator.registry == registry.key() @ PrivateClaimReviewError::OperatorRegistryMismatch,
    )]
    pub operator: Account<'info, PrivateReviewOperator>,
}

#[derive(Accounts)]
#[instruction(args: OpenReviewSessionArgs)]
pub struct OpenReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.active @ PrivateClaimReviewError::RegistryInactive,
        constraint = registry.session_authority == payer.key() @ PrivateClaimReviewError::UnauthorizedSessionAuthority,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        seeds = [SEED_REVIEW_OPERATOR, operator.reviewer_authority.as_ref()],
        bump = operator.bump,
        constraint = operator.registry == registry.key() @ PrivateClaimReviewError::OperatorRegistryMismatch,
        constraint = operator.active @ PrivateClaimReviewError::OperatorInactive,
    )]
    pub operator: Account<'info, PrivateReviewOperator>,
    #[account(
        init,
        payer = payer,
        space = 8 + PrivateClaimReviewSession::INIT_SPACE,
        seeds = [SEED_REVIEW_SESSION, payer.key().as_ref(), args.claim_case.as_ref(), args.session_id.as_bytes()],
        bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(args: DelegateReviewSessionArgs)]
pub struct DelegateReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The delegation program validates ownership and delegated state.
    #[account(
        mut,
        del,
        seeds = [SEED_REVIEW_SESSION, payer.key().as_ref(), args.claim_case.as_ref(), args.session_id.as_bytes()],
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
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.active @ PrivateClaimReviewError::RegistryInactive,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        seeds = [SEED_REVIEW_OPERATOR, reviewer.key().as_ref()],
        bump = operator.bump,
        constraint = operator.registry == registry.key() @ PrivateClaimReviewError::OperatorRegistryMismatch,
        constraint = operator.reviewer_authority == reviewer.key() @ PrivateClaimReviewError::UnauthorizedReviewer,
        constraint = operator.active @ PrivateClaimReviewError::OperatorInactive,
    )]
    pub operator: Account<'info, PrivateReviewOperator>,
    #[account(
        mut,
        seeds = [
            SEED_REVIEW_SESSION,
            review_session.session_authority.as_ref(),
            review_session.claim_case.as_ref(),
            review_session.session_id.as_bytes(),
        ],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[derive(Accounts)]
#[instruction(_args: RecordPrivatePaymentRefArgs)]
pub struct RecordPrivatePaymentRef<'info> {
    #[account(mut)]
    pub payment_attestor: Signer<'info>,
    #[account(
        seeds = [SEED_REVIEW_REGISTRY],
        bump = registry.bump,
        constraint = registry.active @ PrivateClaimReviewError::RegistryInactive,
        constraint = registry.payment_attestor == payment_attestor.key() @ PrivateClaimReviewError::UnauthorizedPaymentAttestor,
    )]
    pub registry: Account<'info, PrivateReviewRegistry>,
    #[account(
        mut,
        seeds = [
            SEED_REVIEW_SESSION,
            review_session.session_authority.as_ref(),
            review_session.claim_case.as_ref(),
            review_session.session_id.as_bytes(),
        ],
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
        seeds = [
            SEED_REVIEW_SESSION,
            review_session.session_authority.as_ref(),
            review_session.claim_case.as_ref(),
            review_session.session_id.as_bytes(),
        ],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[derive(Accounts)]
pub struct FinalizeCommittedReviewSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            SEED_REVIEW_SESSION,
            review_session.session_authority.as_ref(),
            review_session.claim_case.as_ref(),
            review_session.session_id.as_bytes(),
        ],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[derive(Accounts)]
#[instruction(_args: MarkReviewFailedArgs)]
pub struct MarkReviewFailed<'info> {
    pub actor: Signer<'info>,
    #[account(
        mut,
        seeds = [
            SEED_REVIEW_SESSION,
            review_session.session_authority.as_ref(),
            review_session.claim_case.as_ref(),
            review_session.session_id.as_bytes(),
        ],
        bump = review_session.bump,
    )]
    pub review_session: Account<'info, PrivateClaimReviewSession>,
}

#[event]
pub struct ReviewRegistryInitialized {
    pub registry: Pubkey,
    pub authority: Pubkey,
    pub session_authority: Pubkey,
    pub payment_attestor: Pubkey,
    pub active: bool,
}

#[event]
pub struct ReviewRegistryAuthoritySet {
    pub registry: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct ReviewOperatorUpserted {
    pub operator: Pubkey,
    pub registry: Pubkey,
    pub reviewer_authority: Pubkey,
    pub review_binary_hash: [u8; 32],
    pub active: bool,
}

#[event]
pub struct ReviewOperatorActiveSet {
    pub operator: Pubkey,
    pub active: bool,
}

#[event]
pub struct ReviewSessionOpened {
    pub review_session: Pubkey,
    pub session_authority: Pubkey,
    pub review_operator: Pubkey,
    pub reviewer_authority: Pubkey,
    pub claim_case: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionDelegated {
    pub review_session: Pubkey,
    pub session_authority: Pubkey,
    pub claim_case: Pubkey,
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
    pub payment_attestor: Pubkey,
    pub private_payment_ref_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionCommitted {
    pub review_session: Pubkey,
    pub session_authority: Pubkey,
    pub status: u8,
    pub review_artifact_hash: [u8; 32],
    pub private_payment_ref_hash: [u8; 32],
}

#[event]
pub struct ReviewSessionCommitFinalized {
    pub review_session: Pubkey,
    pub session_authority: Pubkey,
    pub status: u8,
    pub committed_at: i64,
}

#[event]
pub struct ReviewSessionFailed {
    pub review_session: Pubkey,
    pub actor: Pubkey,
    pub failure_ref_hash: [u8; 32],
}

#[error_code]
pub enum PrivateClaimReviewError {
    #[msg("review session id is required")]
    EmptySessionId,
    #[msg("review session id exceeds the maximum length")]
    SessionIdTooLong,
    #[msg("review session id does not match the review session account")]
    SessionIdMismatch,
    #[msg("registry authority cannot be the default pubkey")]
    InvalidRegistryAuthority,
    #[msg("session authority cannot be the default pubkey")]
    InvalidSessionAuthority,
    #[msg("payment attestor cannot be the default pubkey")]
    InvalidPaymentAttestor,
    #[msg("reviewer authority cannot be the default pubkey")]
    InvalidReviewerAuthority,
    #[msg("claim case cannot be the default pubkey")]
    InvalidClaimCase,
    #[msg("health plan cannot be the default pubkey")]
    InvalidHealthPlan,
    #[msg("policy series cannot be the default pubkey")]
    InvalidPolicySeries,
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
    #[msg("review registry is inactive")]
    RegistryInactive,
    #[msg("review operator is inactive")]
    OperatorInactive,
    #[msg("review operator is registered to a different registry")]
    OperatorRegistryMismatch,
    #[msg("signer is not the review registry authority")]
    UnauthorizedRegistryAuthority,
    #[msg("signer is not the review session authority")]
    UnauthorizedSessionAuthority,
    #[msg("signer is not the registered reviewer")]
    UnauthorizedReviewer,
    #[msg("review operator does not match this session")]
    UnauthorizedReviewOperator,
    #[msg("signer is not the registered payment attestor")]
    UnauthorizedPaymentAttestor,
    #[msg("signer cannot mark this review failed")]
    UnauthorizedFailureMarker,
    #[msg("private review binary hash does not match the registered operator binary")]
    ReviewBinaryHashMismatch,
    #[msg("invalid private review status")]
    InvalidReviewStatus,
    #[msg("private review session is not delegatable in its current state")]
    ReviewNotDelegatable,
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
    #[msg("approved private review is missing a private payment reference")]
    ApprovedReviewMissingPaymentRef,
    #[msg("private review session was already committed")]
    ReviewAlreadyCommitted,
    #[msg("terminal private review cannot be marked failed")]
    TerminalReviewCannotFail,
    #[msg("signer is not the private review program upgrade authority")]
    UnauthorizedRegistryInitializer,
    #[msg("review session id must not have leading or trailing whitespace")]
    NonCanonicalSessionId,
}

fn is_zero_hash(hash: &[u8; 32]) -> bool {
    hash.iter().all(|byte| *byte == 0)
}

fn is_default_pubkey(pubkey: Pubkey) -> bool {
    pubkey == Pubkey::default()
}

fn require_not_default_pubkey(pubkey: Pubkey, error: PrivateClaimReviewError) -> Result<()> {
    if is_default_pubkey(pubkey) {
        return Err(error.into());
    }
    Ok(())
}

fn require_canonical_session_id(session_id: &str) -> Result<()> {
    require!(
        !session_id.is_empty(),
        PrivateClaimReviewError::EmptySessionId
    );
    require!(
        session_id.len() <= MAX_SESSION_ID_LEN,
        PrivateClaimReviewError::SessionIdTooLong
    );
    require!(
        session_id.trim() == session_id,
        PrivateClaimReviewError::NonCanonicalSessionId
    );
    Ok(())
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
    fn default_pubkey_detection_is_exact() {
        assert!(is_default_pubkey(Pubkey::default()));
        assert!(!is_default_pubkey(Pubkey::new_unique()));
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
