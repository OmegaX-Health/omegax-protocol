// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{OpenMemberPosition, OpenMemberPositionArgs};

impl<'info> OpenMemberPosition<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "open_member_position", hash = "9caf4e68852f7e0c", spec_hash = "5e7ccadbfe85e114")]
    #[inline(always)]
    pub fn handler(&mut self, args: OpenMemberPositionArgs) -> Result<()> {
        guards::open_member_position(self, args)?;
        // Spec effect (needs fill): eligibility_status set args.eligibility_status
        // Spec effect (needs fill): delegated_rights set args.delegated_rights
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
