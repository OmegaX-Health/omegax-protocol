// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{AuthorizeClaimRecipient, AuthorizeClaimRecipientArgs};

impl<'info> AuthorizeClaimRecipient<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "authorize_claim_recipient", hash = "e8ddab55b537f47b", spec_hash = "3452c49e09ad894e")]
    #[inline(always)]
    pub fn handler(&mut self, args: AuthorizeClaimRecipientArgs) -> Result<()> {
        guards::authorize_claim_recipient(self, args)?;
        self.claim_case.updated_at = self.claim_case.updated_at.saturating_add(1);
        self.claim_case.audit_nonce = self.claim_case.audit_nonce.saturating_add(1);
        Ok(())
    }
}
