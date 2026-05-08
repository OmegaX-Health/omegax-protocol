// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{InitProtocolFeeVault, InitProtocolFeeVaultArgs};

impl<'info> InitProtocolFeeVault<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "init_protocol_fee_vault", hash = "dd8fef841cb08f2c", spec_hash = "9fbdd704f95553e3")]
    #[inline(always)]
    pub fn handler(&mut self, args: InitProtocolFeeVaultArgs) -> Result<()> {
        guards::init_protocol_fee_vault(self, args)?;
        self.protocol_fee_vault.accrued_fees = 0;
        self.protocol_fee_vault.withdrawn_fees = 0;
        self.protocol_fee_vault.bump = self.protocol_fee_vault.bump.saturating_add(1);
        self.protocol_fee_vault.audit_nonce = self.protocol_fee_vault.audit_nonce.saturating_add(1);
        Ok(())
    }
}
