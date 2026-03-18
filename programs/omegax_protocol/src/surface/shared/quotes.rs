// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) struct CycleQuoteFields {
    pub(crate) pool: Pubkey,
    pub(crate) member: Pubkey,
    pub(crate) series_ref_hash: [u8; 32],
    pub(crate) payment_mint: Pubkey,
    pub(crate) premium_amount_raw: u64,
    pub(crate) canonical_premium_amount: u64,
    pub(crate) period_index: u64,
    pub(crate) commitment_enabled: bool,
    pub(crate) bond_amount_raw: u64,
    pub(crate) shield_fee_raw: u64,
    pub(crate) protocol_fee_raw: u64,
    pub(crate) oracle_fee_raw: u64,
    pub(crate) net_pool_premium_raw: u64,
    pub(crate) total_amount_raw: u64,
    pub(crate) included_shield_count: u8,
    pub(crate) threshold_bps: u16,
    pub(crate) outcome_threshold_score: u16,
    pub(crate) cohort_hash: [u8; 32],
    pub(crate) expires_at_ts: i64,
    pub(crate) nonce_hash: [u8; 32],
    pub(crate) quote_meta_hash: [u8; 32],
}

pub(crate) fn cycle_quote_message(fields: &CycleQuoteFields) -> Vec<u8> {
    let mut message = Vec::with_capacity(338);
    message.extend_from_slice(b"omegax:cycle_quote:v2");
    message.extend_from_slice(fields.pool.as_ref());
    message.extend_from_slice(fields.member.as_ref());
    message.extend_from_slice(&fields.series_ref_hash);
    message.extend_from_slice(fields.payment_mint.as_ref());
    message.extend_from_slice(&fields.premium_amount_raw.to_le_bytes());
    message.extend_from_slice(&fields.canonical_premium_amount.to_le_bytes());
    message.extend_from_slice(&fields.period_index.to_le_bytes());
    message.push(u8::from(fields.commitment_enabled));
    message.extend_from_slice(&fields.bond_amount_raw.to_le_bytes());
    message.extend_from_slice(&fields.shield_fee_raw.to_le_bytes());
    message.extend_from_slice(&fields.protocol_fee_raw.to_le_bytes());
    message.extend_from_slice(&fields.oracle_fee_raw.to_le_bytes());
    message.extend_from_slice(&fields.net_pool_premium_raw.to_le_bytes());
    message.extend_from_slice(&fields.total_amount_raw.to_le_bytes());
    message.push(fields.included_shield_count);
    message.extend_from_slice(&fields.threshold_bps.to_le_bytes());
    message.extend_from_slice(&fields.outcome_threshold_score.to_le_bytes());
    message.extend_from_slice(&fields.cohort_hash);
    message.extend_from_slice(&fields.expires_at_ts.to_le_bytes());
    message.extend_from_slice(&fields.nonce_hash);
    message.extend_from_slice(&fields.quote_meta_hash);
    message
}

pub(crate) fn cycle_quote_hash(fields: &CycleQuoteFields) -> [u8; 32] {
    *blake3::hash(&cycle_quote_message(fields)).as_bytes()
}

pub(crate) fn cycle_quote_signature_message(quote_hash: &[u8; 32]) -> [u8; 57] {
    let mut message = [0u8; 57];
    message[..25].copy_from_slice(b"omegax:cycle_quote_sig:v2");
    message[25..].copy_from_slice(quote_hash);
    message
}

pub(crate) struct CycleFeeBreakdown {
    pub(crate) protocol_fee_raw: u64,
    pub(crate) oracle_fee_raw: u64,
    pub(crate) net_pool_premium_raw: u64,
    pub(crate) total_amount_raw: u64,
    pub(crate) pool_treasury_amount_raw: u64,
}

pub(crate) fn compute_fee_amount(amount: u64, bps: u16) -> Result<u64> {
    amount
        .checked_mul(u64::from(bps))
        .map(|value| value / 10_000)
        .ok_or(OmegaXProtocolError::MathOverflow.into())
}

pub(crate) fn compute_cycle_fee_breakdown(
    config: &ProtocolConfig,
    oracle_policy: &PoolOraclePolicy,
    premium_amount_raw: u64,
    bond_amount_raw: u64,
    shield_fee_raw: u64,
) -> Result<CycleFeeBreakdown> {
    let total_fee_bps = u32::from(config.protocol_fee_bps)
        .checked_add(u32::from(oracle_policy.oracle_fee_bps))
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    require!(
        total_fee_bps <= u32::from(MAX_PROTOCOL_FEE_BPS),
        OmegaXProtocolError::InvalidOracleFee
    );

    let protocol_fee_raw = compute_fee_amount(premium_amount_raw, config.protocol_fee_bps)?;
    let oracle_fee_raw = compute_fee_amount(premium_amount_raw, oracle_policy.oracle_fee_bps)?;
    let net_pool_premium_raw = premium_amount_raw
        .checked_sub(protocol_fee_raw)
        .and_then(|value| value.checked_sub(oracle_fee_raw))
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    let total_amount_raw = premium_amount_raw
        .checked_add(bond_amount_raw)
        .and_then(|value| value.checked_add(shield_fee_raw))
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    let pool_treasury_amount_raw = net_pool_premium_raw
        .checked_add(bond_amount_raw)
        .and_then(|value| value.checked_add(shield_fee_raw))
        .ok_or(OmegaXProtocolError::MathOverflow)?;

    Ok(CycleFeeBreakdown {
        protocol_fee_raw,
        oracle_fee_raw,
        net_pool_premium_raw,
        total_amount_raw,
        pool_treasury_amount_raw,
    })
}

pub(crate) fn require_cycle_fee_breakdown_matches(
    expected: &CycleFeeBreakdown,
    protocol_fee_raw: u64,
    oracle_fee_raw: u64,
    net_pool_premium_raw: u64,
    total_amount_raw: u64,
) -> Result<()> {
    require!(
        protocol_fee_raw == expected.protocol_fee_raw
            && oracle_fee_raw == expected.oracle_fee_raw
            && net_pool_premium_raw == expected.net_pool_premium_raw
            && total_amount_raw == expected.total_amount_raw,
        OmegaXProtocolError::InvalidCycleQuote
    );
    Ok(())
}

pub(crate) fn finalize_if_quorum_reached(aggregate: &mut Account<CycleOutcomeAggregate>) {
    if aggregate.finalized {
        return;
    }
    if aggregate.quorum_n == 0 {
        return;
    }
    let total_votes = aggregate.pass_votes.saturating_add(aggregate.fail_votes);
    if total_votes < u16::from(aggregate.quorum_n) {
        return;
    }

    let quorum_m = u16::from(aggregate.quorum_m);
    let pass_meets = aggregate.pass_votes >= quorum_m;
    let fail_meets = aggregate.fail_votes >= quorum_m;

    aggregate.finalized = true;
    aggregate.passed = if pass_meets && !fail_meets {
        true
    } else if fail_meets && !pass_meets {
        false
    } else if pass_meets && fail_meets {
        aggregate.pass_votes >= aggregate.fail_votes
    } else {
        false
    };
}
