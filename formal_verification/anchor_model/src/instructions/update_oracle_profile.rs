// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateOracleProfile, UpdateOracleProfileArgs};

impl<'info> UpdateOracleProfile<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_oracle_profile", hash = "effd18baa14112a5", spec_hash = "b4bae1c784772844")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateOracleProfileArgs) -> Result<()> {
        guards::update_oracle_profile(self, args)?;
        self.oracle_profile.supported_schema_count = self.oracle_profile.supported_schema_count.saturating_add(1);
        self.oracle_profile.updated_at_ts = self.oracle_profile.updated_at_ts.saturating_add(1);
        self.oracle_profile.audit_nonce = self.oracle_profile.audit_nonce.saturating_add(1);
        Ok(())
    }
}
