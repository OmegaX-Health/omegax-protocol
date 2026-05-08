// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{InitPoolOracleFeeVault, InitPoolOracleFeeVaultArgs};

impl<'info> InitPoolOracleFeeVault<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "init_pool_oracle_fee_vault", hash = "7083cf4bf52947d0", spec_hash = "fe79747c729121ce")]
    #[inline(always)]
    pub fn handler(&mut self, args: InitPoolOracleFeeVaultArgs) -> Result<()> {
        guards::init_pool_oracle_fee_vault(self, args)?;
        self.pool_oracle_fee_vault.accrued_fees = 0;
        self.pool_oracle_fee_vault.withdrawn_fees = 0;
        self.pool_oracle_fee_vault.bump = self.pool_oracle_fee_vault.bump.saturating_add(1);
        self.pool_oracle_fee_vault.audit_nonce = self.pool_oracle_fee_vault.audit_nonce.saturating_add(1);
        Ok(())
    }
}
