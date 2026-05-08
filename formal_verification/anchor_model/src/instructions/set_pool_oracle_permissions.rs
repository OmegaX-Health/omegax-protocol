// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SetPoolOraclePermissions, SetPoolOraclePermissionsArgs};

impl<'info> SetPoolOraclePermissions<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "set_pool_oracle_permissions", hash = "d71ef7b35d177edd", spec_hash = "b313aa9ca1244f0b")]
    #[inline(always)]
    pub fn handler(&mut self, args: SetPoolOraclePermissionsArgs) -> Result<()> {
        guards::set_pool_oracle_permissions(self, args)?;
        self.pool_oracle_permission_set.updated_at_ts = self.pool_oracle_permission_set.updated_at_ts.saturating_add(1);
        self.pool_oracle_permission_set.bump = self.pool_oracle_permission_set.bump.saturating_add(1);
        self.pool_oracle_permission_set.audit_nonce = self.pool_oracle_permission_set.audit_nonce.saturating_add(1);
        Ok(())
    }
}
