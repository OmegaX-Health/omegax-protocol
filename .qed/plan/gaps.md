# QEDGen Gaps

| Pattern | Status | Hypothesis |
| --- | --- | --- |
| `create_domain_asset_vault` init-only token-program account | Accepted warning | A QEDGen lint should distinguish SPL token program usage for token-account initialization from transfer CPI contexts. See `findings/001-domain-vault-init-token-program.md`. |
| Lifecycle `active` flag written but not enforced on intake/deposit paths | Open finding | A lifecycle-control lint should fail when an `active`/deactivation field is written by a control handler but no user-intake or subscription guard reads it. See `findings/002-write-only-lifecycle-active-flag.md`. |
| Handler coverage drift masked by repo wrapper | Tooling gap | The wrapper should fail on `handler_coverage.kind == "ProgramInstructionNotInSpec"` docs even when they lack `rule` and `severity`. |
