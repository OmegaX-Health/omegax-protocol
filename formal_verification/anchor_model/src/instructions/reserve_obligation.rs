// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ReserveObligation, ReserveObligationArgs};

impl<'info> ReserveObligation<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "reserve_obligation", hash = "5422934bdc1bc2c9", spec_hash = "fa614a2734b69b44")]
    #[inline(always)]
    pub fn handler(&mut self, args: ReserveObligationArgs) -> Result<()> {
        guards::reserve_obligation(self, args)?;
        // Spec effect (needs fill): reserved_amount add_sat 1
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
