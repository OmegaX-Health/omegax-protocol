// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{VerifyOutcomeSchema, VerifyOutcomeSchemaArgs};

impl<'info> VerifyOutcomeSchema<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "verify_outcome_schema", hash = "0e8a05ee4b37e42e", spec_hash = "65a147af77f0a217")]
    #[inline(always)]
    pub fn handler(&mut self, args: VerifyOutcomeSchemaArgs) -> Result<()> {
        guards::verify_outcome_schema(self, args)?;
        // Spec effect (needs fill): verified set args.verified
        self.outcome_schema.updated_at_ts = self.outcome_schema.updated_at_ts.saturating_add(1);
        self.outcome_schema.audit_nonce = self.outcome_schema.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
