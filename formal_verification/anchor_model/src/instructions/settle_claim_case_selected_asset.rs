// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{SettleClaimCaseSelectedAsset, SettleClaimCaseSelectedAssetArgs};

impl<'info> SettleClaimCaseSelectedAsset<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "settle_claim_case_selected_asset", hash = "7d11a35ee44bfbb6", spec_hash = "d14e120ee59e75ed")]
    #[inline(always)]
    pub fn handler(&mut self, args: SettleClaimCaseSelectedAssetArgs) -> Result<()> {
        guards::settle_claim_case_selected_asset(self, args)?;
        // Spec effect (needs fill): paid_amount add_sat 1
        // Spec effect (needs fill): updated_at add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: payout_vault_token_account -> recipient_token_account amount=args.payout_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
