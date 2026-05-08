// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateObligation, CreateObligationArgs};

impl<'info> CreateObligation<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_obligation", hash = "b665360eda5ac9db", spec_hash = "1b53604c91101bfb")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateObligationArgs) -> Result<()> {
        guards::create_obligation(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
