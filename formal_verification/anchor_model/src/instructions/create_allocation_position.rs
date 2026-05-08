// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateAllocationPosition, CreateAllocationPositionArgs};

impl<'info> CreateAllocationPosition<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_allocation_position", hash = "7764faee6f0fd69b", spec_hash = "d8a706eefd9572b4")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateAllocationPositionArgs) -> Result<()> {
        guards::create_allocation_position(self, args)?;
        // Spec effect (needs fill): cap_amount set args.cap_amount
        // Spec effect (needs fill): weight_bps set args.weight_bps
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
