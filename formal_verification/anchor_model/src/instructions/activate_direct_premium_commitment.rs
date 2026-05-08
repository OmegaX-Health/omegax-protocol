// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ActivateDirectPremiumCommitment, ActivateCommitmentArgs};

impl<'info> ActivateDirectPremiumCommitment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "activate_direct_premium_commitment", hash = "eb9bb09153605aa4", spec_hash = "2cbb973e391abb05")]
    #[inline(always)]
    pub fn handler(&mut self, args: ActivateCommitmentArgs) -> Result<()> {
        guards::activate_direct_premium_commitment(self, args)?;
        // Spec effect (needs fill): funded_amount add_sat 1
        // Spec effect (needs fill): activated_amount add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
