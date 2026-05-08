// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{WithdrawPoolTreasurySpl, WithdrawArgs};

impl<'info> WithdrawPoolTreasurySpl<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "withdraw_pool_treasury_spl", hash = "885d8f307f04628f", spec_hash = "f8d923b2ad452405")]
    #[inline(always)]
    pub fn handler(&mut self, args: WithdrawArgs) -> Result<()> {
        guards::withdraw_pool_treasury_spl(self, args)?;
        // Spec effect (needs fill): withdrawn_fees add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: vault_token_account -> recipient_token_account amount=args.amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
