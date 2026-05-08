// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RequestRedemption, RequestRedemptionArgs};

impl<'info> RequestRedemption<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "request_redemption", hash = "e7471279591ffc6d", spec_hash = "6bd663ce19f8bd28")]
    #[inline(always)]
    pub fn handler(&mut self, args: RequestRedemptionArgs) -> Result<()> {
        guards::request_redemption(self, args)?;
        // Spec effect (needs fill): pending_redemption_shares add_sat 1
        // Spec effect (needs fill): pending_redemption_assets add_sat 1
        // Spec effect (needs fill): pending_redemptions add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
