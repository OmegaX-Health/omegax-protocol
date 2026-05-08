// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SettleClaimCase, SettleClaimCaseArgs};

impl<'info> SettleClaimCase<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "settle_claim_case", hash = "2ee67da54e202d46", spec_hash = "4ef6df40937c4782")]
    #[inline(always)]
    pub fn handler(&mut self, args: SettleClaimCaseArgs) -> Result<()> {
        guards::settle_claim_case(self, args)?;
        // Spec effect (needs fill): paid_amount add_sat 1
        // Spec effect (needs fill): reserved_amount add_sat 1
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: vault_token_account -> recipient_token_account amount=claim_net_payout_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
