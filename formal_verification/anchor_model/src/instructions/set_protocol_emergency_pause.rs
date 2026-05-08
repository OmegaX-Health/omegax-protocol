// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SetProtocolEmergencyPause, SetProtocolEmergencyPauseArgs};

impl<'info> SetProtocolEmergencyPause<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "set_protocol_emergency_pause", hash = "07848c5e194ce737", spec_hash = "93bfe5833b96cef3")]
    #[inline(always)]
    pub fn handler(&mut self, args: SetProtocolEmergencyPauseArgs) -> Result<()> {
        guards::set_protocol_emergency_pause(self, args)?;
        // Spec effect (needs fill): emergency_pause set args.emergency_pause
        self.protocol_governance.audit_nonce = self.protocol_governance.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
