// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RefundCommitment, RefundCommitmentArgs};

impl<'info> RefundCommitment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "refund_commitment", hash = "25c2ccff20b375f0", spec_hash = "30673c8ccbb5dae6")]
    #[inline(always)]
    pub fn handler(&mut self, args: RefundCommitmentArgs) -> Result<()> {
        guards::refund_commitment(self, args)?;
        // Spec effect (needs fill): pending_amount add_sat 1
        // Spec effect (needs fill): refunded_amount add_sat 1
        // Spec effect (needs fill): refunded_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: vault_token_account -> recipient_token_account amount=refund_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
