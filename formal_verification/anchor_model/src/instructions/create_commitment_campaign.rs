// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateCommitmentCampaign, CreateCommitmentCampaignArgs};

impl<'info> CreateCommitmentCampaign<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_commitment_campaign", hash = "19120e0020efc39b", spec_hash = "e6c100c505d3ba44")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateCommitmentCampaignArgs) -> Result<()> {
        guards::create_commitment_campaign(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
