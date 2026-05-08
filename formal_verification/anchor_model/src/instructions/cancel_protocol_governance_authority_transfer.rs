// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::CancelProtocolGovernanceAuthorityTransfer;

impl<'info> CancelProtocolGovernanceAuthorityTransfer<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "cancel_protocol_governance_authority_transfer", hash = "676cd334cb980ee2", spec_hash = "603566d5248114ef")]
    #[inline(always)]
    pub fn handler(&mut self) -> Result<()> {
        guards::cancel_protocol_governance_authority_transfer(self)?;
        self.protocol_governance.audit_nonce = self.protocol_governance.audit_nonce.saturating_add(1);
        Ok(())
    }
}
