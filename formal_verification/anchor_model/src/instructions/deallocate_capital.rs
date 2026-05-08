// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{DeallocateCapital, DeallocateCapitalArgs};

impl<'info> DeallocateCapital<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "deallocate_capital", hash = "075c513b2021aa89", spec_hash = "35c78c7c89eaa4f1")]
    #[inline(always)]
    pub fn handler(&mut self, args: DeallocateCapitalArgs) -> Result<()> {
        guards::deallocate_capital(self, args)?;
        // Spec effect (needs fill): allocated_amount sub_sat 1
        // Spec effect (needs fill): allocated_assets sub_sat 1
        // Spec effect (needs fill): total_allocated sub_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
