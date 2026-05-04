# Devnet Treasury Penetration Test - 2026-05-05

## Scope

Authorized devnet-only treasury theft rehearsal against the merged hardened
OmegaX protocol program. The runner used RPC simulation for attack
transactions; it did not submit theft transactions and did not target mainnet.

This run is the post-merge replay requested after PR
[`#55`](https://github.com/OmegaX-Health/omegax-protocol/pull/55) landed.

## Deployment Under Test

- Program: `BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s`
- Program data address: `26iFzy3x31HZhNEvLQzmqBnxybwea9HEWxAU9TNGcBsY`
- Program data authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- Protocol governance PDA: `DrMi8nKioibD8aMcBrgtLyQC6PAPj2N3VZrAN1iV1Vub`
- Protocol governance authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- Merged main baseline: `c000a29ed21428f0f87d888cf8ae7a2b9a22776e`
- Strict run time: `2026-05-04T18:49:38.251Z`
- RPC: `https://api.devnet.solana.com/`

Deployment verification:

```sh
solana program show BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s --url devnet
```

The deployed program is owned by `BPFLoaderUpgradeab1e11111111111111111111111`
and had program data authority `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
at verification time.

## Commands

The prior devnet program `3autasvKVhr7XtEtCrMwvELHMcgkSznNXRdzAe1FuCNX` was
closed to recover devnet rent after the public faucet was rate-limited and
local rehearsal wallets did not hold enough SOL for a fresh program buffer.
This was devnet-only.

```sh
solana program close 3autasvKVhr7XtEtCrMwvELHMcgkSznNXRdzAe1FuCNX --url devnet --bypass-warning
OMEGAX_DEVNET_GOVERNANCE_MIN_LAMPORTS=0 npm run devnet:program:redeploy-fresh
npm run anchor:idl
npm run protocol:contract
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run protocol:bootstrap:devnet-live
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run devnet:treasury:seed-canaries
npm run devnet:treasury:pen-test -- --strict --out-dir artifacts/devnet-security-rehearsal-hardened-2026-05-05
```

The timestamped local evidence files for the strict run are:

- `artifacts/devnet-security-rehearsal-hardened-2026-05-05/devnet-treasury-pen-test-2026-05-04T18-49-38-251Z.json`
- `artifacts/devnet-security-rehearsal-hardened-2026-05-05/devnet-treasury-pen-test-2026-05-04T18-49-38-251Z.md`

The `artifacts/` directory is intentionally ignored by git, so this document is
the tracked public-safe evidence summary.

## Canary Readiness

Strict mode required every canary to be present. All were ready:

- domain asset vault with SPL balance
- protocol fee vault with accrued SPL fees
- pool treasury vault with accrued SPL fees
- pool oracle fee vault with accrued SPL fees
- unsettled linked-claim obligation with usable SPL outflow accounts
- LP position with pending redemption shares and usable vault custody
- allocation-scoped obligation for allocation/PDA binding probes

Live snapshot at strict run:

```json
{
  "domainAssetVaults": 3,
  "protocolFeeVaults": 1,
  "poolTreasuryVaults": 2,
  "poolOracleFeeVaults": 1,
  "claimCases": 4,
  "obligations": 7,
  "lpPositions": 3,
  "allocationPositions": 3
}
```

## Result

No simulated theft path succeeded.

```json
{
  "blocked": 8,
  "vulnerable": 0,
  "skipped": 0,
  "inconclusive": 0
}
```

## Probe Results

| Probe | Target | Status | Expected boundary |
| --- | --- | --- | --- |
| Raw SPL vault drain | `BKofLPmctf8FEkYukexuTu6mTbb1zGPGwErmM2UqPBo6:AAGMft9AGtFViJ5T8nBPvajJEZfiYigkQn5Y2RuA8k7v` | blocked | Attacker is not vault token-account authority. |
| Raw SPL vault drain | `DWSfb1t9m5HMhD3RyAc6yhekuGh4r53wQCMRYqnbwKuG:F419P8Skfkbi12iwoMcHhtDj4ngg8Cn8Y18aS5U1pJot` | blocked | Attacker is not vault token-account authority. |
| Fee withdrawal to attacker | protocol fee vault `GJpQnYggCKmaMQQwKxjTXKj2oUwtgC4jTYhtxxQNKoee` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool treasury vault `FPZdcfLbcYyRqy1aayGPz7s7kJQ4BSCLCbct8DrCpR1R` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool oracle fee vault `5E2AUozvtmVR89ARaQjDtFjcJCwUu8ujxPmF2z5qQywB` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Linked claim settle to attacker | claim `4t7D6ZHQ9i2TAwyXgRaiedL9vN3wmQT5UYAVQuf9D4QB` | blocked | Attacker is not claim/operator authority and recipient is not member/delegate. |
| LP redemption to attacker | LP position `6ExqkC9k1GL1maaFxqPxVK1fYqDsfeG25K9sPAWTQrtB` | blocked | Attacker is not curator/governance and recipient is not LP owner. |
| Allocation obligation settle to attacker | obligation `Gt8dJYv3hxif15qU2i4y6xtA2Mtg3gFyUW7Ssf3sCjEG` | blocked | Attacker is not settlement controller and allocation ledgers bind to the obligation. |

## Notes

- The public devnet faucet was rate-limited, so local devnet SOL was
  consolidated from existing rehearsal wallets and the previous devnet program
  rent was reclaimed before deploying the new hardened program.
- The checked-in devnet manifest and frontend fixture JSON now point at
  `BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s`.
- Stable rails remain simulated with devnet SPL mints. This run does not use
  real USDC and does not prove mainnet custody.
