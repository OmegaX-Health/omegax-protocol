// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{PublishReserveAssetRailPrice, PublishReserveAssetRailPriceArgs};

impl<'info> PublishReserveAssetRailPrice<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "publish_reserve_asset_rail_price", hash = "b9e2da75463631d5", spec_hash = "9ccb6e51a04e0bfc")]
    #[inline(always)]
    pub fn handler(&mut self, args: PublishReserveAssetRailPriceArgs) -> Result<()> {
        guards::publish_reserve_asset_rail_price(self, args)?;
        // Spec effect (needs fill): last_price_usd_1e8 set args.price_usd_1e8
        // Spec effect (needs fill): last_price_confidence_bps set args.confidence_bps
        // Spec effect (needs fill): last_price_published_at_ts set args.published_at_ts
        self.reserve_asset_rail.audit_nonce = self.reserve_asset_rail.audit_nonce.saturating_add(1);
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
