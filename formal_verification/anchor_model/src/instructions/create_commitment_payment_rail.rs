// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateCommitmentPaymentRail, CreateCommitmentPaymentRailArgs};

impl<'info> CreateCommitmentPaymentRail<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_commitment_payment_rail", hash = "6e3cd17919889025", spec_hash = "21abae04f6226d3d")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateCommitmentPaymentRailArgs) -> Result<()> {
        guards::create_commitment_payment_rail(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
