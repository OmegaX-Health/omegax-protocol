// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for invite issuers, member enrollment, and claim delegates.

use super::*;

#[derive(Accounts)]
pub struct RegisterInviteIssuer<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = issuer,
        space = InviteIssuerRegistryEntry::space(MAX_ORG_REF_LEN, MAX_METADATA_URI_LEN),
        seeds = [SEED_INVITE_ISSUER, issuer.key().as_ref()],
        bump,
    )]
    pub invite_issuer_entry: Account<'info, InviteIssuerRegistryEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnrollMemberOpen<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = member,
        space = MembershipRecord::space(),
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Account<'info, PoolCompliancePolicy>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnrollMemberTokenGate<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = member,
        space = MembershipRecord::space(),
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    pub token_gate_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Account<'info, PoolCompliancePolicy>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(subject_commitment: [u8; 32], nonce_hash: [u8; 32], invite_id_hash: [u8; 32], expires_at_ts: i64)]
pub struct EnrollMemberInvitePermit<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = member,
        space = MembershipRecord::space(),
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    pub issuer: Signer<'info>,
    #[account(
        seeds = [SEED_INVITE_ISSUER, issuer.key().as_ref()],
        bump = invite_issuer_entry.bump,
    )]
    pub invite_issuer_entry: Account<'info, InviteIssuerRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Account<'info, PoolCompliancePolicy>>,
    #[account(
        init,
        payer = member,
        space = EnrollmentPermitReplay::space(),
        seeds = [SEED_ENROLLMENT_REPLAY, pool.key().as_ref(), member.key().as_ref(), &nonce_hash],
        bump,
    )]
    pub enrollment_replay: Account<'info, EnrollmentPermitReplay>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetClaimDelegate<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    #[account(
        init_if_needed,
        payer = member,
        space = ClaimDelegateAuthorization::space(),
        seeds = [SEED_CLAIM_DELEGATE, pool.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub claim_delegate: Account<'info, ClaimDelegateAuthorization>,
    pub system_program: Program<'info, System>,
}
