// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SetPoolOracle, SetPoolOracleArgs};

impl<'info> SetPoolOracle<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "set_pool_oracle", hash = "dc83c5d72d2ff750", spec_hash = "59c9aa9f167ef0d0")]
    #[inline(always)]
    pub fn handler(&mut self, args: SetPoolOracleArgs) -> Result<()> {
        guards::set_pool_oracle(self, args)?;
        // Spec effect (needs fill): active set args.active
        self.pool_oracle_approval.updated_at_ts = self.pool_oracle_approval.updated_at_ts.saturating_add(1);
        self.pool_oracle_approval.bump = self.pool_oracle_approval.bump.saturating_add(1);
        self.pool_oracle_approval.audit_nonce = self.pool_oracle_approval.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
