// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RotateProtocolGovernanceAuthority, RotateProtocolGovernanceAuthorityArgs};

impl<'info> RotateProtocolGovernanceAuthority<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "rotate_protocol_governance_authority", hash = "95f05868c11cd4d6", spec_hash = "603566d5248114ef")]
    #[inline(always)]
    pub fn handler(&mut self, args: RotateProtocolGovernanceAuthorityArgs) -> Result<()> {
        guards::rotate_protocol_governance_authority(self, args)?;
        self.protocol_governance.audit_nonce = self.protocol_governance.audit_nonce.saturating_add(1);
        Ok(())
    }
}
