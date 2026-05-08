// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SetPoolOraclePolicy, SetPoolOraclePolicyArgs};

impl<'info> SetPoolOraclePolicy<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "set_pool_oracle_policy", hash = "9cb721eb778fdb7d", spec_hash = "a4703cde8082bb77")]
    #[inline(always)]
    pub fn handler(&mut self, args: SetPoolOraclePolicyArgs) -> Result<()> {
        guards::set_pool_oracle_policy(self, args)?;
        // Spec effect (needs fill): quorum_m set args.quorum_m
        // Spec effect (needs fill): quorum_n set args.quorum_n
        self.pool_oracle_policy.audit_nonce = self.pool_oracle_policy.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
