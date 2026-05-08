// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{AttestClaimCase, AttestClaimCaseArgs};

impl<'info> AttestClaimCase<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "attest_claim_case", hash = "564ba172440687c9", spec_hash = "84fbbd48accf75fa")]
    #[inline(always)]
    pub fn handler(&mut self, args: AttestClaimCaseArgs) -> Result<()> {
        guards::attest_claim_case(self, args)?;
        // Spec effect (needs fill): created_at_ts add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
