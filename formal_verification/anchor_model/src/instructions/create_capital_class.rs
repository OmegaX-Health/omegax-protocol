// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateCapitalClass, CreateCapitalClassArgs};

impl<'info> CreateCapitalClass<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_capital_class", hash = "9980fe381c6ebd48", spec_hash = "420fd1579459781a")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateCapitalClassArgs) -> Result<()> {
        guards::create_capital_class(self, args)?;
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
