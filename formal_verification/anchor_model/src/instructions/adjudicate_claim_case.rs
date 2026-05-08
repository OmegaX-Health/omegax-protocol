// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{AdjudicateClaimCase, AdjudicateClaimCaseArgs};

impl<'info> AdjudicateClaimCase<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "adjudicate_claim_case", hash = "253a13baa1311c84", spec_hash = "9b8ffe69489269ee")]
    #[inline(always)]
    pub fn handler(&mut self, args: AdjudicateClaimCaseArgs) -> Result<()> {
        guards::adjudicate_claim_case(self, args)?;
        // Spec effect (needs fill): review_state set args.review_state
        // Spec effect (needs fill): approved_amount set args.approved_amount
        // Spec effect (needs fill): denied_amount set args.denied_amount
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
