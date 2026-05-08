// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{ConfigureReserveAssetRail, ConfigureReserveAssetRailArgs};

impl<'info> ConfigureReserveAssetRail<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "configure_reserve_asset_rail", hash = "746fd77366faa047", spec_hash = "ca4aa43975ac6cdf")]
    #[inline(always)]
    pub fn handler(&mut self, args: ConfigureReserveAssetRailArgs) -> Result<()> {
        guards::configure_reserve_asset_rail(self, args)?;
        self.reserve_asset_rail.max_confidence_bps = args.max_confidence_bps as u64;
        self.reserve_asset_rail.audit_nonce = self.reserve_asset_rail.audit_nonce.saturating_add(1);
        Ok(())
    }
}
