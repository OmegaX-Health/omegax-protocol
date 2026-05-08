// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateHealthPlanControls, UpdateHealthPlanControlsArgs};

impl<'info> UpdateHealthPlanControls<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_health_plan_controls", hash = "ca396cb82d562708", spec_hash = "c54452a183586b42")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateHealthPlanControlsArgs) -> Result<()> {
        guards::update_health_plan_controls(self, args)?;
        self.health_plan.audit_nonce = self.health_plan.audit_nonce.saturating_add(1);
        Ok(())
    }
}
