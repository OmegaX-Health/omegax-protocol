// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateAllocationCaps, UpdateAllocationCapsArgs};

impl<'info> UpdateAllocationCaps<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_allocation_caps", hash = "249a91df1e5fa879", spec_hash = "66b6065c41a835db")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateAllocationCapsArgs) -> Result<()> {
        guards::update_allocation_caps(self, args)?;
        // Spec effect (needs fill): cap_amount set args.cap_amount
        // Spec effect (needs fill): weight_bps set args.weight_bps
        self.allocation_position.audit_nonce = self.allocation_position.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
