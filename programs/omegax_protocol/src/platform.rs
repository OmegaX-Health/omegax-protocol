// SPDX-License-Identifier: AGPL-3.0-or-later

//! Framework-facing protocol imports.
//!
//! The protocol is being migrated from Anchor to Quasar. Keep implementation
//! modules importing this local seam so the framework swap happens here instead
//! of through scattered direct prelude imports.

#[cfg(not(feature = "quasar"))]
pub use anchor_lang::{
    account, error_code, event, prelude::*, require, require_eq, require_keys_eq, Accounts,
    AnchorDeserialize, AnchorSerialize, InitSpace,
};

#[cfg(feature = "quasar")]
pub use quasar_lang::prelude::*;

#[cfg(feature = "quasar")]
pub use quasar_spl::{InterfaceAccount, Mint, TokenAccountState as TokenAccount, TokenInterface};
