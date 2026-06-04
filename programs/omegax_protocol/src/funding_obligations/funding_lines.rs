// SPDX-License-Identifier: AGPL-3.0-or-later

//! Funding-line instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_plan_control(authority: &Pubkey, plan: &HealthPlanAccountData<'_>) -> Result<()> {
    if *authority == plan.plan_admin || *authority == plan.sponsor_operator {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
fn validate_quasar_optional_policy_series(
    policy_series: Option<&Account<PolicySeriesAccountData<'_>>>,
    expected_policy_series: Pubkey,
    expected_health_plan: Pubkey,
    require_active: bool,
) -> Result<()> {
    if expected_policy_series == ZERO_PUBKEY {
        require!(
            policy_series.is_none(),
            OmegaXProtocolError::PolicySeriesMismatch
        );
        return Ok(());
    }

    let series = policy_series.ok_or(OmegaXProtocolError::PolicySeriesMissing)?;
    require_keys_eq!(
        *series.address(),
        expected_policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require_keys_eq!(
        series.health_plan,
        expected_health_plan,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        quasar_pda_matches(
            series.address(),
            &crate::ID,
            &[
                SEED_POLICY_SERIES,
                expected_health_plan.as_ref(),
                series.series_id().as_bytes(),
            ],
            series.bump,
        ),
        OmegaXProtocolError::PolicySeriesMismatch
    );
    if require_active {
        require!(
            series.status == SERIES_STATUS_ACTIVE,
            OmegaXProtocolError::PolicySeriesMismatch
        );
    }

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn open_funding_line<'info>(
    ctx: &mut Ctx<'info, OpenFundingLine<'info>>,
    policy_series_arg: Pubkey,
    asset_mint: Pubkey,
    line_type: u8,
    funding_priority: u8,
    committed_amount: u64,
    caps_hash: [u8; 32],
    line_id: &str,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    require_quasar_plan_control(&authority, &ctx.accounts.health_plan)?;
    require_quasar_id(line_id)?;
    require_keys_eq!(
        ctx.accounts.domain_asset_vault.asset_mint,
        asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.domain_asset_ledger.asset_mint,
        asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.domain_asset_vault.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.domain_asset_ledger.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    validate_quasar_optional_policy_series(
        ctx.accounts.policy_series.as_ref(),
        policy_series_arg,
        health_plan_key,
        false,
    )?;
    let funding_line_key = *ctx.accounts.funding_line.address();
    let funding_line_bump = ctx.accounts.funding_line.bump;
    ctx.accounts.funding_line.set_inner(
        ctx.accounts.health_plan.reserve_domain,
        health_plan_key,
        policy_series_arg,
        asset_mint,
        line_type,
        funding_priority,
        committed_amount,
        0,
        0,
        0,
        0,
        0,
        FUNDING_LINE_STATUS_OPEN,
        caps_hash,
        funding_line_bump,
        line_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let funding_line_ledger_bump = ctx.accounts.funding_line_ledger.bump;
    ctx.accounts.funding_line_ledger.set_inner(
        funding_line_key,
        asset_mint,
        ReserveBalanceSheet::default(),
        funding_line_ledger_bump,
    );

    if ctx.accounts.plan_reserve_ledger.health_plan == ZERO_PUBKEY {
        let plan_reserve_ledger_bump = ctx.accounts.plan_reserve_ledger.bump;
        ctx.accounts.plan_reserve_ledger.set_inner(
            health_plan_key,
            asset_mint,
            ReserveBalanceSheet::default(),
            plan_reserve_ledger_bump,
        );
    } else {
        require_keys_eq!(
            ctx.accounts.plan_reserve_ledger.health_plan,
            health_plan_key,
            OmegaXProtocolError::HealthPlanMismatch
        );
        require_keys_eq!(
            ctx.accounts.plan_reserve_ledger.asset_mint,
            asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn open_funding_line(
    ctx: Context<OpenFundingLine>,
    args: OpenFundingLineArgs,
) -> Result<()> {
    require_plan_control(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require_id(&args.line_id)?;
    require!(
        ctx.accounts.domain_asset_vault.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        ctx.accounts.domain_asset_ledger.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    validate_optional_policy_series(
        ctx.accounts.policy_series.as_deref(),
        args.policy_series,
        ctx.accounts.health_plan.key(),
        false,
    )?;
    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    funding_line.health_plan = ctx.accounts.health_plan.key();
    funding_line.policy_series = args.policy_series;
    funding_line.asset_mint = args.asset_mint;
    funding_line.line_id = args.line_id;
    funding_line.line_type = args.line_type;
    funding_line.funding_priority = args.funding_priority;
    funding_line.committed_amount = args.committed_amount;
    funding_line.funded_amount = 0;
    funding_line.reserved_amount = 0;
    funding_line.spent_amount = 0;
    funding_line.released_amount = 0;
    funding_line.returned_amount = 0;
    funding_line.status = FUNDING_LINE_STATUS_OPEN;
    funding_line.caps_hash = args.caps_hash;
    funding_line.bump = ctx.bumps.funding_line;

    let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
    funding_line_ledger.funding_line = funding_line.key();
    funding_line_ledger.asset_mint = args.asset_mint;
    funding_line_ledger.sheet = ReserveBalanceSheet::default();
    funding_line_ledger.bump = ctx.bumps.funding_line_ledger;

    let plan_ledger = &mut ctx.accounts.plan_reserve_ledger;
    if plan_ledger.health_plan == ZERO_PUBKEY {
        plan_ledger.health_plan = ctx.accounts.health_plan.key();
        plan_ledger.asset_mint = args.asset_mint;
        plan_ledger.sheet = ReserveBalanceSheet::default();
        plan_ledger.bump = ctx.bumps.plan_reserve_ledger;
    }

    emit!(FundingLineOpenedEvent {
        health_plan: funding_line.health_plan,
        funding_line: funding_line.key(),
        asset_mint: funding_line.asset_mint,
        line_type: funding_line.line_type,
    });

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: OpenFundingLineArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _policy_series_arg: Pubkey,
        asset_mint: Pubkey,
        _line_type: u8,
        _funding_priority: u8,
        _committed_amount: u64,
        _caps_hash: [u8; 32],
        line_id: String<u32, 32>
    )
)]
pub struct OpenFundingLine<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                domain_asset_vault.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), asset_mint.as_ref()],
                domain_asset_vault.bump,
            ) @ OmegaXProtocolError::DomainAssetVaultRequired
        )]
    pub domain_asset_vault: &'info Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
            constraint = quasar_pda_matches(
                domain_asset_ledger.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), asset_mint.as_ref()],
                domain_asset_ledger.bump,
            ) @ OmegaXProtocolError::ReserveDomainMismatch
        )]
    pub domain_asset_ledger: &'info Account<DomainAssetLedger>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + FundingLine::INIT_SPACE,
            seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), args.line_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                funding_line.address(),
                &crate::ID,
                &[SEED_FUNDING_LINE, health_plan.address().as_ref(), line_id],
                funding_line.bump,
            ) @ OmegaXProtocolError::FundingLineMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + FundingLineLedger::INIT_SPACE,
            seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), args.asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                funding_line_ledger.address(),
                &crate::ID,
                &[SEED_FUNDING_LINE_LEDGER, funding_line.address().as_ref(), asset_mint.as_ref()],
                funding_line_ledger.bump,
            ) @ OmegaXProtocolError::FundingLineMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub funding_line_ledger: &'info mut Account<FundingLineLedger>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + PlanReserveLedger::INIT_SPACE,
            seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                plan_reserve_ledger.address(),
                &crate::ID,
                &[SEED_PLAN_RESERVE_LEDGER, health_plan.address().as_ref(), asset_mint.as_ref()],
                plan_reserve_ledger.bump,
            ) @ OmegaXProtocolError::HealthPlanMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub plan_reserve_ledger: &'info mut Account<PlanReserveLedger>,
    #[cfg(not(feature = "quasar"))]
    pub policy_series: Option<Box<Account<'info, PolicySeries>>>,
    #[cfg(feature = "quasar")]
    pub policy_series: Option<Account<PolicySeriesAccountData<'info>>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
