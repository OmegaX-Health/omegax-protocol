// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) struct PremiumLedgerWrite {
    pub(crate) pool: Pubkey,
    pub(crate) series_ref_hash: [u8; 32],
    pub(crate) member: Pubkey,
    pub(crate) period_index: u64,
    pub(crate) amount: u64,
    pub(crate) source: u8,
    pub(crate) paid_at: i64,
    pub(crate) bump: u8,
}

pub(crate) fn write_premium_ledger(ledger: &mut Account<PremiumLedger>, entry: PremiumLedgerWrite) {
    ledger.pool = entry.pool;
    ledger.series_ref_hash = entry.series_ref_hash;
    ledger.member = entry.member;
    ledger.period_index = entry.period_index;
    ledger.amount = entry.amount;
    ledger.source = entry.source;
    ledger.paid_at = entry.paid_at;
    ledger.bump = entry.bump;
}

pub(crate) fn validate_premium_period(
    ledger: &Account<PremiumLedger>,
    pool: Pubkey,
    series_ref_hash: [u8; 32],
    member: Pubkey,
    period_index: u64,
) -> Result<()> {
    if ledger.pool == ZERO_PUBKEY {
        require!(
            period_index == 0,
            OmegaXProtocolV2Error::InvalidPremiumPeriodIndex
        );
        return Ok(());
    }

    require_keys_eq!(
        ledger.pool,
        pool,
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        ledger.series_ref_hash == series_ref_hash,
        OmegaXProtocolV2Error::PolicySeriesIdMismatch
    );
    require!(
        ledger.member == member,
        OmegaXProtocolV2Error::MembershipMemberMismatch
    );

    let expected_period = ledger
        .period_index
        .checked_add(1)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?;
    require!(
        period_index == expected_period,
        OmegaXProtocolV2Error::InvalidPremiumPeriodIndex
    );
    Ok(())
}
