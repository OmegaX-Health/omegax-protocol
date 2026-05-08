// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreatePolicySeries, CreatePolicySeriesArgs};

impl<'info> CreatePolicySeries<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_policy_series", hash = "e204fc7f8a73258d", spec_hash = "5e090c9558a2c009")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreatePolicySeriesArgs) -> Result<()> {
        guards::create_policy_series(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
