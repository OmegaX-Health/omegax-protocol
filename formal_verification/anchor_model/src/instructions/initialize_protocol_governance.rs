// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{InitializeProtocolGovernance, InitializeProtocolGovernanceArgs};

impl<'info> InitializeProtocolGovernance<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "initialize_protocol_governance", hash = "6acce667bc135c29", spec_hash = "2a33bc0ce9e6b17a")]
    #[inline(always)]
    pub fn handler(&mut self, args: InitializeProtocolGovernanceArgs) -> Result<()> {
        guards::initialize_protocol_governance(self, args)?;
        // Spec effect (needs fill): protocol_fee_bps set args.protocol_fee_bps
        // Spec effect (needs fill): emergency_pause set args.emergency_pause
        self.protocol_governance.audit_nonce = 0;
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
