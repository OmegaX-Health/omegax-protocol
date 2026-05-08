// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ActivateWaterfallCommitment, ActivateCommitmentArgs};

impl<'info> ActivateWaterfallCommitment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "activate_waterfall_commitment", hash = "d678511be911a583", spec_hash = "8d5a13eb320da3df")]
    #[inline(always)]
    pub fn handler(&mut self, args: ActivateCommitmentArgs) -> Result<()> {
        guards::activate_waterfall_commitment(self, args)?;
        // Spec effect (needs fill): funded_amount add_sat 1
        // Spec effect (needs fill): activated_amount add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
