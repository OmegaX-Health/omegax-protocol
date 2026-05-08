// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::AcceptProtocolGovernanceAuthority;

impl<'info> AcceptProtocolGovernanceAuthority<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "accept_protocol_governance_authority", hash = "ba3556b65aae6710", spec_hash = "0d1a823c37f7ffa1")]
    #[inline(always)]
    pub fn handler(&mut self) -> Result<()> {
        guards::accept_protocol_governance_authority(self)?;
        self.protocol_governance.governance_authority = self.pending_authority.key();
        self.protocol_governance.audit_nonce = self.protocol_governance.audit_nonce.saturating_add(1);
        Ok(())
    }
}
