// User-owned. Regenerating the spec does NOT overwrite this file.
// Guard checks live in the sibling `crate::guards` module and ARE
// regenerated on every `qedgen codegen`. Drift between the spec
// handler block and the `spec_hash` below fires a compile_error!
// via the `#[qed(verified, ...)]` macro.

use anchor_lang::prelude::*;
use crate::guards;
use qedgen_macros::qed;
use crate::{CreateDomainAssetVault, CreateDomainAssetVaultArgs};

impl<'info> CreateDomainAssetVault<'info> {
    #[qed(verified, spec = "../../omegax_protocol.qedspec", handler = "create_domain_asset_vault", hash = "d2851e3b0794b44e", spec_hash = "02a17bc6ddba02fa")]
    #[inline(always)]
    pub fn handler(&mut self, args: CreateDomainAssetVaultArgs) -> Result<()> {
        guards::create_domain_asset_vault(self, args)?;
        // Spec effect (needs fill): total_assets set 0
        // Spec effect (needs fill): bump add_sat 1
        // Spec effect (needs fill): audit_nonce add_sat 1
        todo!("fill non-mechanical effects, events, transfers, calls")
    }
}
