// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateCapitalClassControls, UpdateCapitalClassControlsArgs};

impl<'info> UpdateCapitalClassControls<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_capital_class_controls", hash = "0e0b974add8178cd", spec_hash = "ae1aae2bb2061ddc")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateCapitalClassControlsArgs) -> Result<()> {
        guards::update_capital_class_controls(self, args)?;
        // Spec effect (needs fill): pause_flags set args.pause_flags
        // Spec effect (needs fill): queue_only_redemptions set args.queue_only_redemptions
        // Spec effect (needs fill): active set args.active
        self.capital_class.audit_nonce = self.capital_class.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
