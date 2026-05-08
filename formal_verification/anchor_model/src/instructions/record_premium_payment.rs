// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{RecordPremiumPayment, RecordPremiumPaymentArgs};

impl<'info> RecordPremiumPayment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "record_premium_payment", hash = "53ee87c0406b5799", spec_hash = "adcab2f6de45cffc")]
    #[inline(always)]
    pub fn handler(&mut self, args: RecordPremiumPaymentArgs) -> Result<()> {
        guards::record_premium_payment(self, args)?;
        // Spec effect (needs fill): funded_amount add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: source_token_account -> vault_token_account amount=args.amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
