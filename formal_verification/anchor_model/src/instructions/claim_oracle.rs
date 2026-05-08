// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::ClaimOracle;

impl<'info> ClaimOracle<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "claim_oracle", hash = "695f301436b441f9", spec_hash = "df70f30c26e72227")]
    #[inline(always)]
    pub fn handler(&mut self) -> Result<()> {
        guards::claim_oracle(self)?;
        self.oracle_profile.claimed = true;
        self.oracle_profile.updated_at_ts = self.oracle_profile.updated_at_ts.saturating_add(1);
        self.oracle_profile.audit_nonce = self.oracle_profile.audit_nonce.saturating_add(1);
        Ok(())
    }
}
