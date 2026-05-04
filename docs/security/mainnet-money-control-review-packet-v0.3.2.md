# Mainnet Money/Control Review Packet - v0.3.2

This packet is for an independent Solana reviewer before any paid mainnet
funding. It is intentionally public-safe: it contains public commit hashes,
links, role expectations, and review scope only. It does not contain private
keypair paths, secrets, or funding instructions.

## Review Request

Required sign-off:

> No known critical or high blockers for claim settlement, obligation
> settlement, LP redemption, fee withdrawals, governance, custody bindings,
> oracle/claim authority, and bootstrap role separation.

Reviewer preference order:

1. Solana security firm.
2. Independent Solana auditor.
3. Senior Solana engineer not involved in this repo.

If no qualified reviewer signs off, mainnet must remain structure-only/no real
reserve funding and public messaging must say the release is not externally
audited.

## Candidate

| Field | Value |
|-------|-------|
| Release | `v0.3.2` |
| PR | [`#55`](https://github.com/OmegaX-Health/omegax-protocol/pull/55) |
| Current PR head | `ace6317a37997ab148f78a0f817565ed323197f1` |
| Liability hardening commit | `d9fa872dc289dcba6886f81551d21ba0d2016bb7` |
| Final merged SHA | BLOCKER: fill after PR merge |
| Branch protection | `main` requires 1 approval, CODEOWNERS review, stale-review dismissal, strict `verify`, admin enforcement |
| Mainnet send status | no mainnet sends, no reserve funding |

## Evidence Files

| Evidence | Path / URL | Notes |
|----------|------------|-------|
| Release evidence | [`../operations/release-v0.3.2-evidence.md`](../operations/release-v0.3.2-evidence.md) | canonical readiness snapshot |
| Devnet treasury report | [`./devnet-treasury-pen-test-2026-05-05.md`](./devnet-treasury-pen-test-2026-05-05.md) | merged hardened replay: `8 blocked`, `0 vulnerable`, `0 skipped`, `0 inconclusive` |
| Privileged-role controls | [`./mainnet-privileged-role-controls.md`](./mainnet-privileged-role-controls.md) | role custody, distinct-key guard, multisig requirement |
| Pre-mainnet pen test | [`./pre-mainnet-pen-test-2026-04-27.md`](./pre-mainnet-pen-test-2026-04-27.md) | finding lineage and fixed rehearsal issues |
| Localnet E2E summary | `artifacts/localnet-e2e-summary-2026-05-04T16-40-45-011Z.json` | ignored artifact; current local evidence path |
| Localnet adversarial matrix | `artifacts/localnet-adversarial-matrix-2026-05-04T16-40-45-011Z.json` | ignored artifact; `57 blocked`, `0 unexpectedSuccess`, `0 inconclusive` |
| Devnet strict JSON | `artifacts/devnet-security-rehearsal-hardened-2026-05-05/devnet-treasury-pen-test-2026-05-04T18-49-38-251Z.json` | ignored artifact; tracked summary above |
| IDL | [`../../idl/omegax_protocol.json`](../../idl/omegax_protocol.json) | generated Anchor IDL |
| Protocol contract | [`../../shared/protocol_contract.json`](../../shared/protocol_contract.json) | generated public contract artifact |

## Remote CI At Current PR Head

| Workflow | URL | Result |
|----------|-----|--------|
| Public CI `verify` | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25332475611/job/74269330889` | PASS |
| CodeQL | `https://github.com/OmegaX-Health/omegax-protocol/runs/74269517022` | PASS |
| Localnet E2E | `https://github.com/OmegaX-Health/omegax-protocol/actions/runs/25332475638/job/74269331451` | PASS |

Any later evidence-only commit on PR `#55` must be checked again before merge.

## Localnet Adversarial Evidence

Latest localnet artifact:
`artifacts/localnet-adversarial-matrix-2026-05-04T16-40-45-011Z.json`.

Summary:

```json
{
  "requiredRuntimeProbeCount": 57,
  "totals": {
    "blocked": 57,
    "unexpectedSuccess": 0,
    "inconclusive": 0
  }
}
```

Instruction ownership summary from
`artifacts/localnet-e2e-summary-2026-05-04T16-40-45-011Z.json`:

```json
{
  "liveCount": 67,
  "ownedCount": 67,
  "missingInstructions": [],
  "unexpectedOwnedInstructions": [],
  "duplicateAssignments": [],
  "blankExceptionReasons": [],
  "retiredLegacyPresent": []
}
```

## Devnet Treasury Evidence

Latest tracked strict devnet report:
[`./devnet-treasury-pen-test-2026-05-05.md`](./devnet-treasury-pen-test-2026-05-05.md).

Summary:

```json
{
  "blocked": 8,
  "vulnerable": 0,
  "skipped": 0,
  "inconclusive": 0
}
```

Required canaries were present for the prior deployed devnet program:

- domain asset vault with SPL balance
- protocol fee vault with accrued SPL fees
- pool treasury vault with accrued SPL fees
- pool oracle fee vault with accrued SPL fees
- unsettled linked-claim obligation with usable SPL outflow accounts
- LP position with pending redemption shares and usable vault custody
- allocation-scoped obligation for allocation/PDA binding probes

Fresh reviewer note: this strict run is the post-merge hardened replay against
devnet program `BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s`.

## Money/Control Surfaces To Review

### Claim Settlement

Primary code paths:

- `programs/omegax_protocol/src/lib.rs`
- `programs/omegax_protocol/src/claims.rs`
- `programs/omegax_protocol/src/kernel.rs`

Review focus:

- claim operator/oracle authority separation
- claim-recipient locking after approval or payout
- post-payout and settled/closed adjudication lock
- claim attestation PDA binding
- settlement recipient, mint, token program, and vault-account binding
- replay/double-settle rejection

### Obligation Settlement

Primary code paths:

- `programs/omegax_protocol/src/obligations.rs`
- `programs/omegax_protocol/src/reserve.rs`
- `programs/omegax_protocol/src/capital_pool.rs`

Review focus:

- full-amount requirement for state-changing transitions to claimable/payable,
  settled, or canceled
- invalid delivery-mode rejection before ledger mutation
- physical custody debits versus allocation-style settlement accounting
- reserve/owed/payable conservation
- optional ledger and allocation PDA binding
- token outflow account validation

### LP Redemption

Primary code paths:

- `programs/omegax_protocol/src/capital_pool.rs`
- `programs/omegax_protocol/src/kernel.rs`

Review focus:

- LP-owner and curator/governance authority checks
- pending-redemption state transitions
- recipient binding to LP owner
- pool vault, share accounting, and mint binding
- replay/double-redemption rejection

### Fee Withdrawals

Primary code paths:

- `programs/omegax_protocol/src/fees.rs`
- `programs/omegax_protocol/src/capital_pool.rs`
- `programs/omegax_protocol/src/oracle.rs`

Review focus:

- protocol fee vault withdrawal authority
- pool treasury fee vault withdrawal authority
- pool oracle fee vault withdrawal authority
- fee policy/account binding
- wrong recipient, wrong mint, wrong token program, and fake vault rejection

### Governance And Pause

Primary code paths:

- `programs/omegax_protocol/src/governance.rs`
- `programs/omegax_protocol/src/kernel.rs`

Review focus:

- protocol governance rotation
- emergency pause and unpause boundaries
- whether one-step authority rotation is acceptable once authority is a Squads
  V4 2-of-3 PDA
- branch protection and CODEOWNERS as release-control plane

### Bootstrap Role Separation

Primary code paths:

- `scripts/support/genesis_live_bootstrap_config.ts`
- `scripts/bootstrap_genesis_live_protocol.ts`
- `tests/genesis_live_bootstrap_config.test.ts`
- `tests/genesis_live_bootstrap_plan_cli.test.ts`

Review focus:

- `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` mainnet guard
- rejection of collapsed privileged roles
- rejection of missing oracle keypair file
- rejection of oracle wallet/keypair mismatch
- wrong-cluster and override behavior
- no-send behavior of `--plan`

## Production Custody Requirement

Default launch custody decision:

- governance authority: Squads V4 2-of-3 multisig PDA
- upgrade authority: Squads V4 2-of-3 multisig PDA or explicitly documented
  equivalent with the same signer set and threshold
- sponsor, sponsor operator, claims operator, oracle, curator, allocator,
  sentinel, reserve admin, and invite authority: distinct public wallets where
  applicable

Current status:

- Squads V4 2-of-3 has not yet been created/proven in this repo evidence.
- Do not fund mainnet reserves until the multisig PDA, threshold, member public
  keys, upgrade-authority posture, and role map are recorded in
  [`../operations/release-v0.3.2-evidence.md`](../operations/release-v0.3.2-evidence.md).

## Non-Claims

The reviewer should treat these as explicit v1 boundaries:

- no external audit is completed unless the reviewer or firm signs this packet
- no arbitrary deposit cap is added
- no arbitrary claim cap is added
- no mixed-asset USDC settlement is introduced
- WBTC, SOL, WETH, or other reserve assets may be displayed as reserve context
  only unless an explicit priced conversion/funding path exists
- settlement is bounded by actual reserve, funding, and allocation capacity
- mainnet real-fund movement remains blocked until all release evidence gates
  are green

## Review Outcome

Reviewer:

Date:

Scope reviewed:

Result:

- [ ] No known critical/high blockers for claim settlement.
- [ ] No known critical/high blockers for obligation settlement.
- [ ] No known critical/high blockers for LP redemption.
- [ ] No known critical/high blockers for fee withdrawals.
- [ ] No known critical/high blockers for governance and pause.
- [ ] No known critical/high blockers for custody bindings.
- [ ] No known critical/high blockers for oracle/claim authority.
- [ ] No known critical/high blockers for bootstrap role separation.

Findings / conditions:
