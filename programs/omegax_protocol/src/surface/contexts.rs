// SPDX-License-Identifier: AGPL-3.0-or-later

//! Anchor `#[derive(Accounts)]` groupings for the current protocol surface.

use super::*;

mod oracles;
pub use oracles::*;

mod schemas;
pub use schemas::*;

mod protocol;
pub use protocol::*;

mod pools;
pub use pools::*;

mod members;
pub use members::*;

mod liquidity;
pub use liquidity::*;

mod rewards;
pub use rewards::*;

mod coverage;
pub use coverage::*;

mod cycles;
pub use cycles::*;

mod treasury;
pub use treasury::*;
