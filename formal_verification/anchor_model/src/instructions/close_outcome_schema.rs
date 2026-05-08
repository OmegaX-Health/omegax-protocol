// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::CloseOutcomeSchema;

impl<'info> CloseOutcomeSchema<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "close_outcome_schema", hash = "5428dfc9b89a4c36", spec_hash = "8a5f16aea12b77ee")]
    #[inline(always)]
    pub fn handler(&mut self) -> Result<()> {
        guards::close_outcome_schema(self)?;
        // Spec effect (needs fill): closed_outcome_schema_count add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
