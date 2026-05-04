# Release v0.3.2 Evidence

This is the production-promotion evidence snapshot for the pre-mainnet security
completion work, including the liability-state hardening branch. It is assembled
for review, not a mainnet funding approval. Mainnet sends and real reserve
funding remain blocked until the remote CI/PR and external-review gates below
are closed.

## 1. Identity

| Field | Value |
|-------|-------|
| Release tag | `v0.3.2` |
| Candidate implementation commit | `d9fa872dc289dcba6886f81551d21ba0d2016bb7` |
| Branch where assembled | merged `main` |
| Date assembled (UTC) | `2026-05-04T18:21:27Z` |
| Maintainer | `Marino Sabijan, MD <marinosabijan@gmail.com>` |
| Final merged main SHA | `cce5975e580ae878a414120fbad65058f85cd766` |

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

## 2. Generated Artifact Hashes

| Artifact | SHA-256 |
|----------|---------|
| `idl/omegax_protocol.json` | `c56e25b8e21240a053fac835ab148f2973aa7311a7fe2230ce4c70c3adee736b` |
| `idl/omegax_protocol.source-hash` file | `081a79ef7df8b521e913efd5de3f1a136fe741adad423ce961e4a865e98b01f6` |
| `idl/omegax_protocol.source-hash` value | `18e706864b7fb32783c27a380107c3ebff786a5cbac4b341867d990b1e10c61c` |
| `shared/protocol_contract.json` | `14157588296844e66f7618fd96e46a5031c53e3c0207b6e6de193d8d96aa0082` |
| `frontend/lib/generated/protocol-contract.ts` | `4a0153cdfc5a4513cf3cd0a680a1e797b910c08449b9d95da9165f97bc83a8fa` |
| `frontend/lib/generated/protocol-contract.js` | `aba0d1fdf84bf9aa1f3c26405baef2174a05c12227d977ac99120aae78ce1e0c` |

| Drift gate | Result |
|------------|--------|
| `npm run anchor:idl` | PASS, regenerated checked-in IDL and source hash |
| `npm run protocol:contract` | PASS, regenerated checked-in protocol contract artifacts |
| `npm run idl:freshness:check` | PASS, inside `npm run verify:public` |
| `npm run protocol:contract:check` | PASS, inside `npm run verify:public` |

## 3. CI Evidence

| Workflow | Last green PR run URL | Run ID | Conclusion | Status |
|----------|-------------------|--------|------------|--------|
| Public CI (`ci.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25335270808/job/74278805238` | `25335270808` | success | PASS |
| CodeQL (`codeql.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/runs/74278957301` | `74278957301` | success | PASS |
| Localnet E2E (`localnet-e2e.yml`) | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25335270813/job/74278805898` | `25335270813` | success | PASS |

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

Last remote `main` baseline before this local commit:

| Workflow | Run URL | Run ID | Head SHA | Conclusion |
|----------|---------|--------|----------|------------|
| Public CI | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25328526732` | `25328526732` | `be440d686f276e8dcc79316c3de9c18c634579a3` | success |
| CodeQL | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25328526977` | `25328526977` | `be440d686f276e8dcc79316c3de9c18c634579a3` | success |

## 4. Branch Protection State

| Setting | Expected | Actual |
|---------|----------|--------|
| Branch protection enabled on `main` | yes | yes |
| Required PR review approvals | `0` until another write collaborator/reviewer exists | `0` |
| CODEOWNERS review | not enforceable with one write collaborator who is also PR author | no |
| Stale review dismissal | yes | yes |
| Required status checks | `verify` | `verify` |
| Strict status checks | yes | yes |
| Admin enforcement | yes | yes |
| Force pushes blocked | yes | yes |
| Branch deletion blocked | yes | yes |

Branch-protection API snapshot, `2026-05-04T18:10:14Z`:

```json
{
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "required_status_checks": {
    "contexts": ["verify"],
    "strict": true
  },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Review-operations note: the GitHub collaborator list visible to the maintainer
token currently contains only `marinosabijan`. GitHub rejected self-approval
with `Review Can not approve your own pull request`. A future team-review policy
requires adding at least one non-author collaborator, team, or outside reviewer
with repository review permission.

## 5. Local Validation Lanes

| Lane | Command | Result | Artifact |
|------|---------|--------|----------|
| Liability-state Rust regression | `npm run rust:test` | PASS: `80 passed`, `0 failed` | console output |
| Liability-state Node/static regression | `npm run test:node` | PASS: `234 passed`, `0 failed` | console output |
| Repo baseline health | `npm run verify:public` | PASS | SBOM under `artifacts/sbom/` |
| Localnet protocol-surface audit | `OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet` | PASS | `artifacts/localnet-e2e-summary-2026-05-04T16-40-45-011Z.json` |
| Executable adversarial localnet | included in localnet E2E | PASS: `57 blocked`, `0 unexpectedSuccess`, `0 inconclusive` | `artifacts/localnet-adversarial-matrix-2026-05-04T16-40-45-011Z.json` |
| Operator drawer simulation | `SOLANA_KEYPAIR=<devnet governance keypair> npm run devnet:operator:drawer:sim` | PASS: `FAIL=0`; expected idempotent collisions and fixture skips only | console output |
| Mainnet preflight, no sends | `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 OMEGAX_LIVE_SETTLEMENT_MINT=4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump npm run protocol:bootstrap:genesis-live -- --plan` | BLOCKER: current operator env is missing `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH`; command failed before send path | console error; no transactions sent |
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
| Devnet bootstrap | PASS against merged hardened binary at `BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s`; `OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run protocol:bootstrap:devnet-live` |
| Canary seeding | PASS, all required treasury canaries seeded against the new devnet program |
| Strict pen-test | PASS, `npm run devnet:treasury:pen-test -- --strict --out-dir artifacts/devnet-security-rehearsal-hardened-2026-05-05` |
| Strict result | `8 blocked`, `0 vulnerable`, `0 skipped`, `0 inconclusive` |
| Evidence | `artifacts/devnet-security-rehearsal-hardened-2026-05-05/devnet-treasury-pen-test-2026-05-04T18-49-38-251Z.json`, `artifacts/devnet-security-rehearsal-hardened-2026-05-05/devnet-treasury-pen-test-2026-05-04T18-49-38-251Z.md`, tracked summary `docs/security/devnet-treasury-pen-test-2026-05-05.md` |
| Hardened binary replay | PASS: merged hardened binary was redeployed, bootstrapped, seeded, and strict-tested on devnet |

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
| Settlement mint supplied for current replay | `4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump` |
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
OMEGAX_LIVE_SETTLEMENT_MINT=4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump \
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
| Internal pen-test report | `docs/security/devnet-treasury-pen-test-2026-05-04.md` |
| Outstanding high/critical internal findings | none known after the strict devnet run; external review still missing |
| Independent-review packet | `docs/security/mainnet-money-control-review-packet-v0.3.2.md` |

Public messaging must not claim audited, fully decentralized claims, uncapped
solvency, or mixed-asset settlement. Other reserve assets may be shown as
reserve context only; they do not settle USDC claims without an explicit
priced/haircut/conversion or funding action.

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

## 12. Sign-off

This evidence is sufficient for local pre-mainnet readiness review only. It is
not sufficient for public mainnet funding until Squads V4 2-of-3 governance and
upgrade posture are proven, the current operator env successfully produces a
no-send mainnet plan, the merged hardened binary is redeployed/rehearsed on
devnet, and money/control surfaces receive internal or external money/control
review.

Signed-off-by: Marino Sabijan, MD <marinosabijan@gmail.com>  
Date: 2026-05-04
