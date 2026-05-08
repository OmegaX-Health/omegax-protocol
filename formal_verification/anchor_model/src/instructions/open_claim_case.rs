// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{OpenClaimCase, OpenClaimCaseArgs};

impl<'info> OpenClaimCase<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "open_claim_case", hash = "ebcaa5b2db72932d", spec_hash = "740f9d0db202a52b")]
    #[inline(always)]
    pub fn handler(&mut self, args: OpenClaimCaseArgs) -> Result<()> {
        guards::open_claim_case(self, args)?;
        self.claim_case.intake_status = self.claim_case.intake_status.saturating_add(1);
        self.claim_case.review_state = 0;
        self.claim_case.audit_nonce = self.claim_case.audit_nonce.saturating_add(1);
        Ok(())
    }
}
