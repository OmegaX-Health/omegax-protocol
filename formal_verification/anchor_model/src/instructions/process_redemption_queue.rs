// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ProcessRedemptionQueue, ProcessRedemptionQueueArgs};

impl<'info> ProcessRedemptionQueue<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "process_redemption_queue", hash = "c50fb5c5d1beae52", spec_hash = "c2e90e7ee570d567")]
    #[inline(always)]
    pub fn handler(&mut self, args: ProcessRedemptionQueueArgs) -> Result<()> {
        guards::process_redemption_queue(self, args)?;
        // Spec effect (needs fill): pending_redemption_shares sub_sat 1
        // Spec effect (needs fill): total_assets sub_sat 1
        // Spec effect (needs fill): withdrawn_fees add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: vault_token_account -> recipient_token_account amount=redemption_net_payout_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
