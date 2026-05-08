// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SettleObligation, SettleObligationArgs};

impl<'info> SettleObligation<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "settle_obligation", hash = "b10f615cb4a4318a", spec_hash = "5e4d63d23be16aec")]
    #[inline(always)]
    pub fn handler(&mut self, args: SettleObligationArgs) -> Result<()> {
        guards::settle_obligation(self, args)?;
        // Spec effect (needs fill): reserved_amount add_sat 1
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: vault_token_account -> recipient_token_account amount=settlement_net_payout_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
