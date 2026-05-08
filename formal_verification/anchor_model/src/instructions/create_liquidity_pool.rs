// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateLiquidityPool, CreateLiquidityPoolArgs};

impl<'info> CreateLiquidityPool<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_liquidity_pool", hash = "173dd366fb25f601", spec_hash = "208b83be5162b0bf")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateLiquidityPoolArgs) -> Result<()> {
        guards::create_liquidity_pool(self, args)?;
        self.liquidity_pool.audit_nonce = self.liquidity_pool.audit_nonce.saturating_add(1);
        Ok(())
    }
}
