// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{InitializeSeriesReserveLedger, InitializeSeriesReserveLedgerArgs};

impl<'info> InitializeSeriesReserveLedger<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "initialize_series_reserve_ledger", hash = "68e1bf5ac4751717", spec_hash = "ed26d5ab533f58bc")]
    #[inline(always)]
    pub fn handler(&mut self, args: InitializeSeriesReserveLedgerArgs) -> Result<()> {
        guards::initialize_series_reserve_ledger(self, args)?;
        self.series_reserve_ledger.bump = self.series_reserve_ledger.bump.saturating_add(1);
        self.series_reserve_ledger.audit_nonce = self.series_reserve_ledger.audit_nonce.saturating_add(1);
        Ok(())
    }
}
