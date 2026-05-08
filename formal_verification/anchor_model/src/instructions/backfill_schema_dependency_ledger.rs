// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{BackfillSchemaDependencyLedger, BackfillSchemaDependencyLedgerArgs};

impl<'info> BackfillSchemaDependencyLedger<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "backfill_schema_dependency_ledger", hash = "6390945597f6be23", spec_hash = "0b4b03138ed2bcf5")]
    #[inline(always)]
    pub fn handler(&mut self, args: BackfillSchemaDependencyLedgerArgs) -> Result<()> {
        guards::backfill_schema_dependency_ledger(self, args)?;
        self.schema_dependency_ledger.updated_at_ts = self.schema_dependency_ledger.updated_at_ts.saturating_add(1);
        self.schema_dependency_ledger.bump = self.schema_dependency_ledger.bump.saturating_add(1);
        self.schema_dependency_ledger.audit_nonce = self.schema_dependency_ledger.audit_nonce.saturating_add(1);
        Ok(())
    }
}
