// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{UpdateMemberEligibility, UpdateMemberEligibilityArgs};

impl<'info> UpdateMemberEligibility<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "update_member_eligibility", hash = "ed0c6f0793fc283b", spec_hash = "65d85d7bcf4a064e")]
    #[inline(always)]
    pub fn handler(&mut self, args: UpdateMemberEligibilityArgs) -> Result<()> {
        guards::update_member_eligibility(self, args)?;
        // Spec effect (needs fill): eligibility_status set args.eligibility_status
        // Spec effect (needs fill): delegated_rights set args.delegated_rights
        // Spec effect (needs fill): active set args.active
        self.member_position.audit_nonce = self.member_position.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
