// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{WithdrawPoolTreasurySol, WithdrawArgs};

impl<'info> WithdrawPoolTreasurySol<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "withdraw_pool_treasury_sol", hash = "b884f7310afb9b01", spec_hash = "e4b02f21102d9529")]
    #[inline(always)]
    pub fn handler(&mut self, args: WithdrawArgs) -> Result<()> {
        guards::withdraw_pool_treasury_sol(self, args)?;
        // Spec effect (needs fill): withdrawn_fees add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
