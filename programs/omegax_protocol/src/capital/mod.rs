// SPDX-License-Identifier: AGPL-3.0-or-later

//! Capital-market instruction module group.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

mod allocations;
mod classes;
mod impairments;
mod liquidity_pool;
mod lp_positions;
mod redemptions;

pub(crate) use allocations::{
    allocate_capital, create_allocation_position, deallocate_capital, update_allocation_caps,
};
pub(crate) use classes::{create_capital_class, update_capital_class_controls};
pub(crate) use impairments::mark_impairment;
pub(crate) use liquidity_pool::create_liquidity_pool;
pub(crate) use lp_positions::{deposit_into_capital_class, update_lp_position_credentialing};
pub(crate) use redemptions::{process_redemption_queue, request_redemption};

pub use allocations::{
    AllocateCapital, CreateAllocationPosition, DeallocateCapital, UpdateAllocationCaps,
};
pub use classes::{CreateCapitalClass, UpdateCapitalClassControls};
pub use impairments::MarkImpairment;
pub use liquidity_pool::CreateLiquidityPool;
pub use lp_positions::{DepositIntoCapitalClass, UpdateLpPositionCredentialing};
pub use redemptions::{ProcessRedemptionQueue, RequestRedemption};

pub(crate) use allocations::{
    __client_accounts_allocate_capital, __client_accounts_create_allocation_position,
    __client_accounts_deallocate_capital, __client_accounts_update_allocation_caps,
};
pub(crate) use classes::{
    __client_accounts_create_capital_class, __client_accounts_update_capital_class_controls,
};
pub(crate) use impairments::__client_accounts_mark_impairment;
pub(crate) use liquidity_pool::__client_accounts_create_liquidity_pool;
pub(crate) use lp_positions::{
    __client_accounts_deposit_into_capital_class,
    __client_accounts_update_lp_position_credentialing,
};
pub(crate) use redemptions::{
    __client_accounts_process_redemption_queue, __client_accounts_request_redemption,
};
