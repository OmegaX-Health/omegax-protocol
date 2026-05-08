// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RegisterOracle, RegisterOracleArgs};

impl<'info> RegisterOracle<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "register_oracle", hash = "ec47f9b90b9428d1", spec_hash = "eb00409aca277403")]
    #[inline(always)]
    pub fn handler(&mut self, args: RegisterOracleArgs) -> Result<()> {
        guards::register_oracle(self, args)?;
        self.oracle_profile.supported_schema_count = self.oracle_profile.supported_schema_count.saturating_add(1);
        self.oracle_profile.active = true;
        self.oracle_profile.audit_nonce = self.oracle_profile.audit_nonce.saturating_add(1);
        Ok(())
    }
}
