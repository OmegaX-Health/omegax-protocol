# Mainnet Privileged-Role Controls

> **Audience**: maintainers and release managers preparing the Genesis Protect Acute v1 mainnet bootstrap, and any future mainnet release that needs to demonstrate role custody to a sponsor, LP, or auditor.
>
> **Companion docs**: [`../operations/genesis-live-bootstrap.md`](../operations/genesis-live-bootstrap.md) (the operator runbook), [`../operations/release-candidate-evidence-template.md`](../operations/release-candidate-evidence-template.md) (the production-promotion gate), [`./pre-mainnet-pen-test-2026-04-27.md`](./pre-mainnet-pen-test-2026-04-27.md) (PT-05 finding lineage).

## Why this exists

The on-chain program enforces role checks (`require_governance`, `require_plan_control`, `require_claim_operator`, `require_pool_control`, `require_curator_control`, `require_allocator`) plus pool-scoped oracle approval/permission checks for LP-backed claim attestations. The safety story for any of those checks is **only as strong as the wallet behind the role**. Pre-pen-test, the Genesis live bootstrap defaulted every privileged role to the governance signer if the role-specific environment variable was unset — a single key compromise drained the whole protocol. PT-05 closed the silent collapse via the opt-in `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` guard. This doc closes the rest of the gap: matrix, multisig requirement, break-glass exception, and rotation/recovery posture.

## 1. Privileged roles

Every entry below maps to a `require_*` check in the onchain program source (`programs/omegax_protocol/src/kernel.rs`, `programs/omegax_protocol/src/kernel/`, and the relevant domain module) and to a configurable role wallet in `scripts/support/genesis_live_bootstrap_config.ts`. The "Pre-fix default" column documents what the bootstrap fell back to before the mainnet guard added in this doc landed; the **mainnet column is what production must use**.

| Role | Guards (program) | Allowed actions | Custody owner | Mainnet signer (required) | Pre-fix default |
|------|------------------|-----------------|---------------|---------------------------|-----------------|
| **Protocol governance** | `require_governance` | `set_protocol_emergency_pause`, `rotate_protocol_governance_authority`, protocol-config updates | OmegaX Health FZCO | **Multisig PDA** (Squads V4 or equivalent) — see §2 | local keypair via `SOLANA_KEYPAIR` |
| **Reserve domain admin** | `require_governance` (domain ops) | reserve-domain pause flags, vault wiring | Same as governance for v1; can split later | Multisig PDA | `governanceAuthority` |
| **Plan admin / Sponsor** | `require_plan_control` | `update_health_plan`, sponsor-budget funding, plan pause flags | Sponsor entity | Distinct wallet (multisig recommended for >$10k exposure) | `governanceAuthority` |
| **Sponsor operator** | `require_plan_control` (sponsor lane) | premium recording, sponsor-budget operations | Operations team | Distinct wallet | `governanceAuthority` |
| **Claims operator** | `require_claim_operator` | `attach_claim_evidence_ref`, `adjudicate_claim_case`, `settle_claim_case` | Claims operations team | Distinct hot wallet (rotated quarterly), backed by ≥2-of-N multisig for high-value claims | `governanceAuthority` |
| **Oracle authority** | `OracleProfile` signer + verified-schema gate; non-LP claims require the plan's configured oracle authority; LP-backed claims require active `PoolOracleApproval` and `POOL_ORACLE_PERMISSION_ATTEST_CLAIM` | `register_oracle`, `claim_oracle`, `attest_claim_case` from oracle profile | Oracle operator (OmegaX Health for v1) | Distinct hot wallet, rotated quarterly | (none — must be set explicitly) |
| **Pool curator** | `require_curator_control` | `create_capital_class`, capital-class restriction updates, manager credentialing | LP product team | Distinct wallet, multisig for production | `governanceAuthority` |
| **Pool allocator** | `require_allocator` | `create_allocation_position`, allocation cap & weight updates | Capital management team | Distinct wallet | `governanceAuthority` |
| **Pool sentinel** | `require_pool_control` (sentinel lane) | pool-level pause flags, redemption-queue throttle | On-call sentinel | Distinct hot wallet (low blast radius — short-lived rotation OK) | `governanceAuthority` |
| **Membership invite authority** | (off-chain) | issuing invite permits for invite-only plans | Plan admin | Distinct wallet | (none — must be set explicitly when invite-only) |

The on-chain enforcement does not change with this doc — every `require_*` call still does authority equality. What changes is **what each authority is**.

## 2. Multisig requirement

Mainnet `governance_authority` (and any role whose blast radius is "drain or pause the entire protocol") **must be backed by a multisig program**, not a raw keypair. Recommended approach:

- **Squads V4** (recommended): industry standard for Solana, supports member rotation, threshold updates, time-lock, and explicit confirmation flow. The on-chain governance authority becomes the multisig vault PDA.
- **Realms / spl-governance** (alternative): native Solana governance. Higher overhead but matches the on-chain governance program already used for proposal-driven operations.
- **3rd-party validated multisig** with documented vendor: equivalent to either above if the vendor is audited and the threshold is ≥2-of-N for protocol-governance and ≥2-of-N for high-value roles.

For pre-mainnet rehearsal, the operator may use a single keypair with `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` set as the documented break-glass override (see §3). This is **not** acceptable for the live mainnet launch — the multisig must be in place before the first real-money seed.

### Cross-role distinct-key rule

Beyond the multisig requirement, every operational role above must resolve to a **distinct** wallet. The bootstrap-script guard (see §4) enforces this for production clusters; the on-chain check does not. Two roles collapsing onto one key is an explicit single-point-of-compromise — even if that one key is itself a multisig.

## 3. Break-glass exception

Three flags govern the bootstrap-script guards:

| Flag | Purpose | When to use |
|------|---------|-------------|
| `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` | Refuse a config where any two operational roles resolve to the same pubkey | **Always** for mainnet bootstraps (now required by the guard, not optional) |
| `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` | Bypass the mainnet hard-fail and allow privileged roles to default to the governance signer | Only for documented rehearsal runs or genuine emergency recovery (see §6); the override **must** be recorded in the release-candidate evidence template |
| `OMEGAX_LIVE_CLUSTER_OVERRIDE` | Force the bootstrap to treat the target cluster as `devnet` even though the RPC URL looks like mainnet | Only when running an isolated rehearsal against a private mainnet-beta-like cluster; never in production |

Every break-glass usage **must** be logged in the corresponding [release-candidate evidence document](../operations/release-candidate-evidence-template.md) §8 (External audit / bug-bounty posture). An undocumented break-glass run is a release blocker, not an accepted risk.

## 4. Bootstrap-script guard (mainnet hard-fail)

`scripts/support/genesis_live_bootstrap_config.ts` blocks production-cluster bootstraps that would route privileged roles through the local signer.

The guard fires when **all** of these are true:

1. the resolved RPC URL points at a mainnet endpoint (`*.mainnet-beta.solana.com`, `mainnet.helius-rpc.com`, `mainnet.metaplex.com`, anything containing `mainnet`), **or** the operator explicitly set `OMEGAX_LIVE_CLUSTER_OVERRIDE=mainnet`
2. `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` is **not** set

In that combination the loader requires:

- `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` — failure mode: distinct-keys flag missing
- explicit values for every operational role: `OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN`, `OMEGAX_LIVE_SPONSOR_WALLET`, `OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET`, `OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET`, `OMEGAX_LIVE_POOL_CURATOR_WALLET`, `OMEGAX_LIVE_POOL_ALLOCATOR_WALLET`, `OMEGAX_LIVE_POOL_SENTINEL_WALLET` — failure mode: each missing var listed in the error so the operator can fix in one pass

When `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` is set, the loader emits a loud `[bootstrap] BREAK-GLASS …` warning to stderr at config-load time and proceeds. The warning is the audit trail.

## 5. Role rotation

Each role has a defined rotation cadence and method. Rotation does not require an emergency.

| Role | Cadence | Method | Approval |
|------|---------|--------|----------|
| Protocol governance | On-demand only (post-incident or member change) | `rotate_protocol_governance_authority` instruction (already on-chain); behind the multisig signing flow | ≥2-of-N multisig + DCO-signed release-candidate evidence |
| Plan admin / Sponsor | On-demand (sponsor change, contract end) | governance-authorized plan-config update | ≥1 governance multisig signer + sponsor signature |
| Claims operator | Quarterly | governance-authorized plan-config update; old key remains valid for a 7-day overlap before being removed | ≥1 governance multisig signer |
| Oracle authority | Quarterly | `register_oracle` / `claim_oracle` from new authority, then pool approval/permission updates for LP-backed claim products | Oracle operator + ≥1 governance multisig signer |
| Pool curator / allocator / sentinel | Quarterly (or on personnel change) | governance-authorized pool-config update | ≥1 governance multisig signer |

Rotation runbooks should be added to `docs/operations/genesis-live-bootstrap.md` as the live procedure stabilises post-launch.

## 6. Emergency pause and incident recovery

Emergency pause is the protocol's pre-built circuit breaker. It does not change ownership of any state — it temporarily blocks the instruction surfaces that move money.

| Authority | Instruction | Effect | Recovery |
|-----------|-------------|--------|----------|
| Protocol governance | `set_protocol_emergency_pause(true)` | Sets `protocol_governance.emergency_pause = true`; every check that gates on `!emergency_pause` returns `ProtocolEmergencyPaused` | `set_protocol_emergency_pause(false)` from same authority once the incident is resolved |
| Reserve domain admin | reserve-domain pause flags | Pauses inflows/outflows on a single reserve domain | Same authority unsets the flags |
| Plan admin | plan pause flags | Pauses claim intake or sponsor operations on a single plan | Same authority unsets |
| Pool sentinel | pool pause flags | Pauses LP entry, redemptions, or both on a single pool | Same authority unsets |

### Incident recovery flow

1. **Triage**: confirm the incident severity. For P0 (active loss-of-funds risk), pause first, investigate second.
2. **Pause**: smallest-blast-radius authority that contains the incident triggers the pause. Use protocol-wide pause only when the incident spans plans/pools/domains.
3. **Communicate**: post to the public status surface (when one exists) and the operations channel; **do not** post wallet addresses or evidence hashes that could expose member identity.
4. **Investigate**: capture the failing transaction, slot, signer, and instruction; add to the pen-test report appendix.
5. **Remediate**: code or config change behind a normal PR + release-candidate evidence cycle. **Never** ship an emergency fix without filling the evidence template — even a 24-hour incident window does not change the production-promotion bar.
6. **Unpause**: smallest-blast-radius authority that closed the incident un-pauses. Document the incident timeline in `docs/security/` as `incident-YYYY-MM-DD-summary.md` with the same public-safety rules as other security docs.

### Break-glass for incident response

If the multisig signer set is unreachable during an incident (e.g., a member is incapacitated), the documented break-glass is to use `OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1` for the unpause/recovery operation only, log it loudly in the incident summary, and immediately rotate the affected role(s) once the multisig set is restored.

## 7. Public-posture statement (for release notes and external docs)

For release notes, sponsor decks, or LP communication that touches role custody, use this template (adjust with truthful values for the release):

> Genesis Protect Acute v1 separates protocol governance, plan admin, claims operator, oracle authority, pool curator, pool allocator, and pool sentinel onto distinct wallets enforced at bootstrap time. Protocol governance is held by `<multisig vendor + threshold>` (e.g., `Squads V4 2-of-3`). Operational roles are held by hot wallets rotated quarterly; high-value claim operations require multisig co-signature. The mainnet bootstrap is blocked by repository tooling (`scripts/support/genesis_live_bootstrap_config.ts`) when any privileged role would default to the governance signer. The break-glass exception (`OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1`) is recorded in the release-candidate evidence document for any release where it was used.

## Appendix: source-of-truth pointers

- Program role checks: `programs/omegax_protocol/src/kernel.rs`, `programs/omegax_protocol/src/kernel/`, and the calling domain modules (`require_governance`, `require_plan_control`, `require_claim_operator`, `require_pool_control`, `require_curator_control`, `require_allocator`)
- Bootstrap config: `scripts/support/genesis_live_bootstrap_config.ts`
- PT-05 distinct-keys guard: shipped in commit `8c219fe`; tests in `tests/genesis_live_bootstrap_config.test.ts`
- Pen-test report: [`./pre-mainnet-pen-test-2026-04-27.md`](./pre-mainnet-pen-test-2026-04-27.md)
- Live bootstrap runbook: [`../operations/genesis-live-bootstrap.md`](../operations/genesis-live-bootstrap.md)
- Release-candidate evidence template: [`../operations/release-candidate-evidence-template.md`](../operations/release-candidate-evidence-template.md)
