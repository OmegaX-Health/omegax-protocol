// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateHealthPlan, CreateHealthPlanArgs};

impl<'info> CreateHealthPlan<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_health_plan", hash = "674c95c5afd30de1", spec_hash = "0685d4ddfe528b39")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateHealthPlanArgs) -> Result<()> {
        guards::create_health_plan(self, args)?;
        self.health_plan.audit_nonce = self.health_plan.audit_nonce.saturating_add(1);
        Ok(())
    }
}
