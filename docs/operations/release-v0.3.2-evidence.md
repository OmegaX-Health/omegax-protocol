# Release v0.3.2 Evidence

This is the production-promotion evidence snapshot for the pre-mainnet security
completion work, including the liability-state hardening branch and the Phase 0
mainnet surface-gating pass. It is assembled for review, not a mainnet funding
approval. Mainnet sends and real reserve funding remain blocked until the
no-send mainnet preflight, production custody, and self-audit signoff gates
below are closed.

## 1. Identity

| Field | Value |
|-------|-------|
| Release tag | `v0.3.2` |
| Candidate implementation commit | `bd87ce95ea58bbdf70ffeb8181327311fe34a232` |
| Branch where assembled | merged `main` |
| Date assembled (UTC) | `2026-05-05T09:55:37Z` |
| Maintainer | `Marino Sabijan, MD <marinosabijan@gmail.com>` |
| Final merged main SHA | `bd87ce95ea58bbdf70ffeb8181327311fe34a232` |

Push status: direct `main` push was rejected by branch protection, so the
candidate moved to PR
[`#55`](https://github.com/OmegaX-Health/omegax-protocol/pull/55). The PR
branch was pushed and merged through PR
[`#55`](https://github.com/OmegaX-Health/omegax-protocol/pull/55) into
`main` at merge commit `cce5975e580ae878a414120fbad65058f85cd766`. Remote CI was
green on PR head `c90dc307237e06831c00344019a23cb7091918b7` before merge. The
repo currently has a single write collaborator, `marinosabijan`, who was also
the PR author, so GitHub could not record a non-author approving review. Branch
protection is therefore set to a solo-maintainer mode that keeps strict
required status checks while removing the impossible separate-approval rule.

Phase 0 surface gating was merged through PR
[`#68`](https://github.com/OmegaX-Health/omegax-protocol/pull/68) into
`main` at merge commit `bd87ce95ea58bbdf70ffeb8181327311fe34a232`. The PR head
`c71839c0778f235db54ac13978c871a1e0da6944` passed Public CI, CodeQL, and
Localnet E2E before merge. The merged `main` commit also passed Public CI and
CodeQL after merge.

## 2. Generated Artifact Hashes

| Artifact | SHA-256 |
|----------|---------|
| `idl/omegax_protocol.json` | `8f125d44dd7d3a42b8e97dbc95ed5644cd2bb69b10ed30481dce8fd118dabf82` |
| `idl/omegax_protocol.source-hash` file | `91217de7d3d43b83ebec95ac27edbd6a02a97207831198d00b953ad48cee2b66` |
| `idl/omegax_protocol.source-hash` value | `b6b759e8d453ff0b03ee3e0b56de3758d9a697fc5a71aa182bb0c64e3aaecf1c` |
| `shared/protocol_contract.json` | `d4d46a73a199bfa2035785856bc9d4badf3d3326a307200c651d7046766f3076` |
| `frontend/lib/generated/protocol-contract.ts` | `ecdb19541f8457ec721739f1e2911662631e8266e754402eb1cf59c9617d7933` |
| `frontend/lib/generated/protocol-contract.js` | `5c682f1fd138654cedf5dbd21a966edb6624c50c00dddec07096313dfb90e5e1` |

| Drift gate | Result |
|------------|--------|
| `npm run anchor:idl` | PASS, regenerated checked-in IDL and source hash |
| `npm run protocol:contract` | PASS, regenerated checked-in protocol contract artifacts |
| `npm run idl:freshness:check` | PASS, inside `npm run verify:public` |
| `npm run protocol:contract:check` | PASS, inside `npm run verify:public` |

## 3. CI Evidence

| Workflow | Last green PR run URL | Run ID | Conclusion | Status |
|----------|-------------------|--------|------------|--------|
| Public CI (`ci.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25369212613/job/74387996776` | `25369212613` | success | PASS |
| CodeQL (`codeql.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25369212596/job/74387996691` | `25369212596` | success | PASS |
| Localnet E2E (`localnet-e2e.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25368679568/job/74386147252` | `25368679568` | success | PASS |

PR state at solo-maintainer branch-protection closure:

| Field | Value |
|-------|-------|
| PR | [`#55`](https://github.com/OmegaX-Health/omegax-protocol/pull/55) |
| Head SHA | `c90dc307237e06831c00344019a23cb7091918b7` |
| Draft state | ready for review |
| Merge state | merged into `main` |
| Review decision | not required in solo-maintainer mode |
| Current reviews | automated Codex comments only; GitHub rejected self-approval |
| Merge commit | `cce5975e580ae878a414120fbad65058f85cd766` |

Phase 0 PR state:

| Field | Value |
|-------|-------|
| PR | [`#68`](https://github.com/OmegaX-Health/omegax-protocol/pull/68) |
| Head SHA | `c71839c0778f235db54ac13978c871a1e0da6944` |
| Draft state | ready for review |
| Merge state | merged into `main` |
| Review decision | not required in solo-maintainer mode |
| Merge commit | `bd87ce95ea58bbdf70ffeb8181327311fe34a232` |

Last remote `main` baseline before this local commit:

| Workflow | Run URL | Run ID | Head SHA | Conclusion |
|----------|---------|--------|----------|------------|
| Public CI | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25328526732` | `25328526732` | `be440d686f276e8dcc79316c3de9c18c634579a3` | success |
| CodeQL | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25328526977` | `25328526977` | `be440d686f276e8dcc79316c3de9c18c634579a3` | success |

## 4. Branch Protection State

| Setting | Expected | Actual |
|---------|----------|--------|
| Branch protection enabled on `main` | yes | yes |
| Required PR review approvals | `1` independent approval for release landing | `1` |
| CODEOWNERS review | required for protocol/security-owned paths | yes |
| Stale review dismissal | yes | yes |
| Last-push approval | yes | yes |
| Required status checks | `verify`, `qedgen`, `localnet-e2e` | `verify`, `qedgen`, `localnet-e2e` |
| Strict status checks | yes | yes |
| Admin enforcement | yes | yes |
| Force pushes blocked | yes | yes |
| Branch deletion blocked | yes | yes |

Branch-protection API snapshot, `2026-05-08T14:28:12Z`:

```json
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true,
    "required_approving_review_count": 1
  },
  "required_status_checks": {
    "contexts": ["verify", "qedgen", "localnet-e2e"],
    "strict": true
  },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Review-operations note: this policy intentionally blocks zero-review release
landing. If a PR author cannot self-approve, a non-author collaborator, team, or
outside reviewer with repository review permission must approve before merge.

## 5. Local Validation Lanes

| Lane | Command | Result | Artifact |
|------|---------|--------|----------|
| Liability-state Rust regression | `npm run rust:test` | PASS: `84 passed`, `0 failed` | console output |
| Liability-state Node/static regression | `npm run test:node` | PASS: `251 passed`, `0 failed` | console output |
| Repo baseline health | `npm run verify:public` | PASS | SBOM under `artifacts/sbom/` |
| Localnet protocol-surface audit | `OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet` | PASS: `68/68` live instructions owned | `artifacts/localnet-e2e-summary-2026-05-06T07-38-44-043Z.json` |
| Asset-agnostic commitment custody | included in localnet E2E | PASS: `3 payment assets`, `300 exact refunds`, `27 blocked custody/outflow probes`, `9 activation checks` | `artifacts/localnet-commitment-custody-2026-05-06T07-38-44-043Z.json` |
| Executable adversarial localnet | included in localnet E2E | PASS: `62 blocked`, `0 unexpectedSuccess`, `0 inconclusive` | `artifacts/localnet-adversarial-matrix-2026-05-06T07-38-44-044Z.json` |
| Operator drawer simulation | `SOLANA_KEYPAIR=<devnet governance keypair> npm run devnet:operator:drawer:sim` | PASS: `FAIL=0`; expected idempotent collisions and fixture skips only | console output |
| Mainnet preflight, no sends | `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 OMEGAX_LIVE_SETTLEMENT_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v npm run protocol:bootstrap:genesis-live -- --plan` | BLOCKER: current operator env is missing `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH`; command failed before send path | console error; no transactions sent |
| Mainnet unsafe config tests | `npm run verify:public` node suite | PASS | `tests/genesis_live_bootstrap_config.test.ts`, `tests/genesis_live_bootstrap_plan_cli.test.ts` |

## 6. Dependency Scan

| Field | Value |
|-------|-------|
| `license:audit` | PASS inside `npm run verify:public` |
| Root npm production deps | `103` |
| Frontend npm production deps | `465` |
| Cargo deps | `253` |
| npm advisories | root `3`, frontend `3`; all covered by `docs/operations/dependency-advisory-risk-acceptance.md` |
| SBOM status | PASS, wrote `artifacts/sbom/root-npm-sbom.json`, `artifacts/sbom/frontend-npm-sbom.json`, `artifacts/sbom/cargo-tree.txt` |

## 7. Actuarial Gate

| Field | Value |
|-------|-------|
| Actuarial review state | PASS |
| Source | `npm run genesis:actuarial:review` generated `examples/genesis-protect-acute-actuarial-review/review-output.json` and memo artifacts with no tracked diff |
| Reviewer | internal maintainer, `2026-05-04` |

This release does not add arbitrary launch deposit caps or arbitrary claim caps.
Product terms may define coverage limits; settlement remains constrained by
actual settlement-asset reserve/funding/allocation capacity.

## 8. Devnet Treasury Gate

| Field | Value |
|-------|-------|
| Devnet bootstrap | PASS against post-PR `#70` merged binary at `mBQYJkivNJFT5egjQ2VGFb8sBMiaZMUr5GDNvKkxp1f`; `OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run protocol:bootstrap:devnet-live` |
| Canary seeding | PASS, all required treasury canaries seeded against the new devnet program |
| Strict pen-test | PASS, `npm run devnet:treasury:pen-test -- --strict --out-dir artifacts/devnet-security-rehearsal-post-merge-2026-05-06` |
| Strict result | `8 blocked`, `0 vulnerable`, `0 skipped`, `0 inconclusive` |
| Evidence | `artifacts/devnet-security-rehearsal-post-merge-2026-05-06/devnet-treasury-pen-test-2026-05-06T05-01-11-114Z.json`, `artifacts/devnet-security-rehearsal-post-merge-2026-05-06/devnet-treasury-pen-test-2026-05-06T05-01-11-114Z.md`, tracked summary `docs/security/devnet-treasury-pen-test-2026-05-06.md` |
| Hardened binary replay | PASS: PR `#70` merge commit `63e6f4cc7a7a3b59ab1b8fa39cfa607cb78f9bfb` was redeployed, bootstrapped, seeded, and strict-tested on devnet |

## 9. Mainnet Preflight

No mainnet transaction was sent. The successful `--plan` path exits after
config/keypair validation and JSON plan output; the current replay stopped even
earlier at required-environment validation.

The derived addresses below are from the previous successful no-send plan and
must be regenerated after the current operator environment supplies the live
oracle keypair path and final role-map inputs.

| Field | Value |
|-------|-------|
| RPC | `https://api.mainnet-beta.solana.com` |
| Program ID planned | `Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B` |
| Settlement mint supplied for current replay | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet USDC) |
| Governance authority used for plan | `AiNPYZQkbfcTkSh3r9vPKAMgMa3TbU47Jk3TaKTCB4Sg` |
| Governance config address | `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU` |
| Reserve domain | `WfQ7PjCTwuTCn3KM4mxUmyjQSw3RvcnyT3Gfdg2WUoq` |
| Health plan | `D38bBYTWAkcyJZHFaZLRYRJErwLNB45YKJPfxU4PL5F6` |
| Event 7 series | `6ZfyGQUcW132mEmYBmT5RtoagZyTHi2gTuGQUHW2qTLX` |
| Travel 30 series | `29XmfdaHceAeAvtiESAcNDXLsJxEqW2RBa3DttTUUcco` |
| Pool | `GvfgrHmzoPZXpn1H7L85R7qA9iFr3dBhZYNb5WeXMXqt` |
| Senior class | `7BUpgc71EhLoFcH7PdqHkNyrGYdiCcX9FQ3rS55Moyui` |
| Junior class | `9JAzzfoyysVg1DDoAdXZBN2Hy834RkgGnv5shUg3qywR` |
| Role-map status | previous plan used distinct wallets for sponsor, sponsor operator, claims operator, oracle, curator, allocator, sentinel, and reserve admin; current no-send replay is blocked by missing operator env |
| Multisig posture | REQUIRED before real reserve funding; Squads V4 2-of-3 has not been created/proven in this evidence package |

Current no-send replay:

```sh
OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 \
OMEGAX_LIVE_SETTLEMENT_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
npm run protocol:bootstrap:genesis-live -- --plan
```

Result: BLOCKER. The command failed before any send path with
`Missing required environment variable OMEGAX_LIVE_ORACLE_KEYPAIR_PATH`. This
is a safe failure and keeps mainnet untouched, but it means the final production
oracle signer parity, role map, and multisig posture are not yet freshly proven
from the current operator environment.

Unsafe config proof:

- Missing `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS` fails in node tests.
- Collapsed roles fail in node tests.
- Missing oracle keypair file fails in `--plan` mode before send path.
- Oracle wallet/keypair mismatch fails in `--plan` mode before send path.
- Mainnet-like custom RPC URLs are treated as mainnet unless explicitly overridden.

## 10. External Review / Public Posture

| Field | Value |
|-------|-------|
| External audit completed for this release | no — no external audit conducted |
| Bug bounty program | no public bounty recorded in this repo |
| Third-party review date | none |
| Internal pen-test report | `docs/security/devnet-treasury-pen-test-2026-05-05.md` |
| Outstanding high/critical internal findings | none known after the strict devnet run; external review still missing |
| Independent-review packet | `docs/security/mainnet-money-control-review-packet-v0.3.2.md` |

Public messaging must not claim audited, fully decentralized claims, or uncapped
solvency. Multi-asset payout support is explicit selected-asset settlement:
the router/oracle service chooses an approved payout asset before settlement,
and the on-chain settlement path requires that asset's active, payout-enabled,
fresh confidence-bounded `ReserveAssetRail`. The program does not silently mutate a USDC
claim ledger while draining a WBTC/SOL/WETH vault and does not perform DEX
swaps in this pass.

`$OMEGAX` (`4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump`) is not the
default claims settlement mint. It may be configured as a commitment payment
rail or a last-resort selected payout rail only when explicitly enabled,
payout-enabled, and fresh confidence-bounded.

## 11. Liability-State Hardening Addendum

The prior internal review blockers are fixed locally on the liability-hardening
branch:

- `settle_obligation` now rejects partial transitions to claimable/payable,
  settled, or canceled before reserve/settlement/cancellation mutation.
- `adjudicate_claim_case` now rejects post-payout, settled, closed, or
  obligation-terminal rewrites before claim fields are updated.
- `create_obligation` now rejects unsupported delivery modes before owed ledger
  booking.
- The IDL exposes `PartialObligationTransitionUnsupported`,
  `InvalidObligationDeliveryMode`, and `ClaimAdjudicationLocked`.

These fixes are locally proven by `npm run rust:test`, `npm run test:node`,
`npm run verify:public`, and
`OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet`. Remote PR CI is also
green on `d9fa872dc289dcba6886f81551d21ba0d2016bb7`.

## 12. Asset-Agnostic Commitment Custody Addendum

The preorder custody closure was refreshed on `2026-05-06T04:02:51Z` across
three localnet payment rails: an OMEGAX-like token, a stable/settlement-like SPL
token, and a non-settlement reserve asset. The suite proves the pooled
`DomainAssetVault` custody model before activation without relying on
OMEGAX-specific names or decimals.

- Each asset seeded `100` pending commitment positions and verified exact
  equality across the SPL vault balance, `DomainAssetVault.total_assets`, and
  `CommitmentLedger.pending_amount`.
- The refund matrix returned `300` exact user refunds and rejected attacker
  refund, wrong recipient, wrong mint, wrong token program, fake vault token
  account, and zero-accrual fee-withdrawal probes.
- The same-mint outflow matrix rejected fee-withdrawal, claim-settlement,
  obligation-settlement, and LP-redemption attempts against vaults containing
  pending commitment deposits.
- Activation coverage now checks `DIRECT_PREMIUM`, `TREASURY_CREDIT`, and
  `WATERFALL_RESERVE` for every payment rail. Waterfall activation decrements
  pending token liability by the full deposited token amount while reserve
  funding/capacity accounting remains haircut-adjusted.

## 13. Sign-off

This evidence is sufficient for local pre-mainnet readiness review only. It is
not sufficient for public mainnet funding until Squads V4 2-of-3 governance and
upgrade posture are proven, the current operator env successfully produces a
no-send mainnet plan, the merged hardened binary is redeployed/rehearsed on
devnet, and money/control surfaces receive internal or external money/control
review.

Signed-off-by: Marino Sabijan, MD <marinosabijan@gmail.com>  
Date: 2026-05-04
