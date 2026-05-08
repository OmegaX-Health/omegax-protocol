// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{InitPoolTreasuryVault, InitPoolTreasuryVaultArgs};

impl<'info> InitPoolTreasuryVault<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "init_pool_treasury_vault", hash = "e8329d4635a05be7", spec_hash = "8b15c7ee7ae6df10")]
    #[inline(always)]
    pub fn handler(&mut self, args: InitPoolTreasuryVaultArgs) -> Result<()> {
        guards::init_pool_treasury_vault(self, args)?;
        self.pool_treasury_vault.accrued_fees = 0;
        self.pool_treasury_vault.withdrawn_fees = 0;
        self.pool_treasury_vault.bump = self.pool_treasury_vault.bump.saturating_add(1);
        self.pool_treasury_vault.audit_nonce = self.pool_treasury_vault.audit_nonce.saturating_add(1);
        Ok(())
    }
}
