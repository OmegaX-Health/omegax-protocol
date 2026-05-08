// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{DepositCommitment, DepositCommitmentArgs};

impl<'info> DepositCommitment<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "deposit_commitment", hash = "a565148caeb38715", spec_hash = "deee6f9921118b94")]
    #[inline(always)]
    pub fn handler(&mut self, args: DepositCommitmentArgs) -> Result<()> {
        guards::deposit_commitment(self, args)?;
        // Spec effect (needs fill): pending_amount add_sat 1
        // Spec effect (needs fill): next_queue_index add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        // Spec transfer: source_token_account -> vault_token_account amount=commitment_deposit_amount
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
