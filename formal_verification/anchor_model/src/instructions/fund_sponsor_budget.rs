// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{FundSponsorBudget, FundSponsorBudgetArgs};

impl<'info> FundSponsorBudget<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "fund_sponsor_budget", hash = "19172b59ab0e63bc", spec_hash = "deb677a1a2453be0")]
    #[inline(always)]
    pub fn handler(&mut self, args: FundSponsorBudgetArgs) -> Result<()> {
        guards::fund_sponsor_budget(self, args)?;
        // Spec effect (needs fill): funded_amount add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: source_token_account -> vault_token_account amount=args.amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
