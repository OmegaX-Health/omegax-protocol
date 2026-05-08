// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{VersionPolicySeries, VersionPolicySeriesArgs};

impl<'info> VersionPolicySeries<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "version_policy_series", hash = "f80770b4b58c533d", spec_hash = "4461b55293f336f0")]
    #[inline(always)]
    pub fn handler(&mut self, args: VersionPolicySeriesArgs) -> Result<()> {
        guards::version_policy_series(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
