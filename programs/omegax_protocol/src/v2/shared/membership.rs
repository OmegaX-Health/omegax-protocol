// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn authorize_claim_signer(
    claimant: Pubkey,
    pool: Pubkey,
    member: Pubkey,
    delegate_enabled: bool,
    claim_delegate: Option<&Account<ClaimDelegateAuthorization>>,
) -> Result<()> {
    if claimant == member {
        return Ok(());
    }

    require!(
        delegate_enabled,
        OmegaXProtocolV2Error::DelegateNotAuthorized
    );

    let record = claim_delegate.ok_or(OmegaXProtocolV2Error::DelegateNotAuthorized)?;
    require!(record.active, OmegaXProtocolV2Error::DelegateNotAuthorized);
    require!(
        record.pool == pool,
        OmegaXProtocolV2Error::DelegateNotAuthorized
    );
    require!(
        record.member == member,
        OmegaXProtocolV2Error::DelegateNotAuthorized
    );
    require!(
        record.delegate == claimant,
        OmegaXProtocolV2Error::DelegateNotAuthorized
    );

    Ok(())
}

pub(crate) fn write_membership(
    membership: &mut Account<MembershipRecord>,
    pool: Pubkey,
    member: Pubkey,
    subject_commitment: [u8; 32],
    bump: u8,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    membership.pool = pool;
    membership.member = member;
    membership.subject_commitment = subject_commitment;
    membership.status = MEMBERSHIP_STATUS_ACTIVE;
    if membership.enrolled_at == 0 {
        membership.enrolled_at = now;
    }
    membership.updated_at = now;
    membership.bump = bump;
    Ok(())
}
