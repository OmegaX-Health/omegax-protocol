// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateLpPositionCredentialing, UpdateLpPositionCredentialingArgs};

impl<'info> UpdateLpPositionCredentialing<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_lp_position_credentialing", hash = "f060083f62eca1ff", spec_hash = "b69105dd65b7c39d")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateLpPositionCredentialingArgs) -> Result<()> {
        guards::update_lp_position_credentialing(self, args)?;
        // Spec effect (needs fill): credentialed set args.credentialed
        self.lp_position.audit_nonce = self.lp_position.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
