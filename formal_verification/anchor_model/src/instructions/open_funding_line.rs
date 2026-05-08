// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{OpenFundingLine, OpenFundingLineArgs};

impl<'info> OpenFundingLine<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "open_funding_line", hash = "a3d0582003d20081", spec_hash = "518e032cc4727a54")]
    #[inline(always)]
    pub fn handler(&mut self, args: OpenFundingLineArgs) -> Result<()> {
        guards::open_funding_line(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
