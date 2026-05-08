// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{MarkImpairment, MarkImpairmentArgs};

impl<'info> MarkImpairment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "mark_impairment", hash = "89b12df147ffb503", spec_hash = "abb568aaf1328245")]
    #[inline(always)]
    pub fn handler(&mut self, args: MarkImpairmentArgs) -> Result<()> {
        guards::mark_impairment(self, args)?;
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
