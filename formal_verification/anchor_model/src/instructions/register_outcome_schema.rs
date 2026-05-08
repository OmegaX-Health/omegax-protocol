// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RegisterOutcomeSchema, RegisterOutcomeSchemaArgs};

impl<'info> RegisterOutcomeSchema<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "register_outcome_schema", hash = "1a2e20f1f0cebfa0", spec_hash = "f221a0049a653a23")]
    #[inline(always)]
    pub fn handler(&mut self, args: RegisterOutcomeSchemaArgs) -> Result<()> {
        guards::register_outcome_schema(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
