// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ReleaseReserve, ReleaseReserveArgs};

impl<'info> ReleaseReserve<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "release_reserve", hash = "31139d946cb9810f", spec_hash = "fa614a2734b69b44")]
    #[inline(always)]
    pub fn handler(&mut self, args: ReleaseReserveArgs) -> Result<()> {
        guards::release_reserve(self, args)?;
        // Spec effect (needs fill): reserved_amount add_sat 1
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
