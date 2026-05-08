// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateReserveDomain, CreateReserveDomainArgs};

impl<'info> CreateReserveDomain<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_reserve_domain", hash = "79db929c3facd74a", spec_hash = "7f683bed76900e21")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateReserveDomainArgs) -> Result<()> {
        guards::create_reserve_domain(self, args)?;
        self.reserve_domain.audit_nonce = self.reserve_domain.audit_nonce.saturating_add(1);
        Ok(())
    }
}
