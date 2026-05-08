// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{AttachClaimEvidenceRef, AttachClaimEvidenceRefArgs};

impl<'info> AttachClaimEvidenceRef<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "attach_claim_evidence_ref", hash = "7d05001981864461", spec_hash = "d1227e0710b83368")]
    #[inline(always)]
    pub fn handler(&mut self, args: AttachClaimEvidenceRefArgs) -> Result<()> {
        guards::attach_claim_evidence_ref(self, args)?;
        self.claim_case.updated_at = self.claim_case.updated_at.saturating_add(1);
        self.claim_case.audit_nonce = self.claim_case.audit_nonce.saturating_add(1);
        Ok(())
    }
}
