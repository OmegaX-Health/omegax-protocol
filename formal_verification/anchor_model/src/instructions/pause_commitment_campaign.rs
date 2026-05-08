// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{PauseCommitmentCampaign, PauseCommitmentCampaignArgs};

impl<'info> PauseCommitmentCampaign<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "pause_commitment_campaign", hash = "1de21e628da41479", spec_hash = "fbd6825eeb6b6ccf")]
    #[inline(always)]
    pub fn handler(&mut self, args: PauseCommitmentCampaignArgs) -> Result<()> {
        guards::pause_commitment_campaign(self, args)?;
        self.campaign.audit_nonce = self.campaign.audit_nonce.saturating_add(1);
        Ok(())
    }
}
