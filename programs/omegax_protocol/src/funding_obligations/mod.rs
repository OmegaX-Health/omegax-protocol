// SPDX-License-Identifier: AGPL-3.0-or-later

//! Funding-line and obligation instruction module group.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

mod funding_lines;
mod inflows;
mod obligations;
mod reserves;
mod settlement;

pub(crate) use funding_lines::open_funding_line;
pub(crate) use inflows::{fund_sponsor_budget, record_premium_payment};
pub(crate) use obligations::create_obligation;
pub(crate) use reserves::{release_reserve, reserve_obligation};
pub(crate) use settlement::settle_obligation;

pub use funding_lines::OpenFundingLine;
pub use inflows::{FundSponsorBudget, RecordPremiumPayment};
pub use obligations::CreateObligation;
pub use reserves::{ReleaseReserve, ReserveObligation};
pub use settlement::SettleObligation;

pub(crate) use funding_lines::__client_accounts_open_funding_line;
pub(crate) use inflows::{
    __client_accounts_fund_sponsor_budget, __client_accounts_record_premium_payment,
};
pub(crate) use obligations::__client_accounts_create_obligation;
pub(crate) use reserves::{
    __client_accounts_release_reserve, __client_accounts_reserve_obligation,
};
pub(crate) use settlement::__client_accounts_settle_obligation;
