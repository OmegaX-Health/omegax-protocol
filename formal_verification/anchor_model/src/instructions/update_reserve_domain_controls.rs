// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateReserveDomainControls, UpdateReserveDomainControlsArgs};

impl<'info> UpdateReserveDomainControls<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_reserve_domain_controls", hash = "cf1f22ddd2eb3177", spec_hash = "c1896d55c64866c9")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateReserveDomainControlsArgs) -> Result<()> {
        guards::update_reserve_domain_controls(self, args)?;
        // Spec effect (needs fill): allowed_rail_mask set args.allowed_rail_mask
        // Spec effect (needs fill): pause_flags set args.pause_flags
        // Spec effect (needs fill): active set args.active
        self.reserve_domain.audit_nonce = self.reserve_domain.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
