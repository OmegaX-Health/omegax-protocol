// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{DepositIntoCapitalClass, DepositIntoCapitalClassArgs};

impl<'info> DepositIntoCapitalClass<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "deposit_into_capital_class", hash = "9e47af0e79d68f26", spec_hash = "2c932da2c88bf745")]
    #[inline(always)]
    pub fn handler(&mut self, args: DepositIntoCapitalClassArgs) -> Result<()> {
        guards::deposit_into_capital_class(self, args)?;
        // Spec effect (needs fill): total_assets add_sat 1
        // Spec effect (needs fill): total_shares add_sat 1
        // Spec effect (needs fill): nav_assets add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: source_token_account -> vault_token_account amount=args.amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
