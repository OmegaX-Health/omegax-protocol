// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{AllocateCapital, AllocateCapitalArgs};

impl<'info> AllocateCapital<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "allocate_capital", hash = "20f45822038685a9", spec_hash = "304a6db6cbef58d6")]
    #[inline(always)]
    pub fn handler(&mut self, args: AllocateCapitalArgs) -> Result<()> {
        guards::allocate_capital(self, args)?;
        // Spec effect (needs fill): allocated_amount add_sat 1
        // Spec effect (needs fill): allocated_assets add_sat 1
        // Spec effect (needs fill): total_allocated add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
