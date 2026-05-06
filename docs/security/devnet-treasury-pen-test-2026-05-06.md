# Devnet Treasury Penetration Test - 2026-05-06

## Scope

Authorized devnet-only treasury theft rehearsal against the post-PR
[`#70`](https://github.com/OmegaX-Health/omegax-protocol/pull/70) OmegaX
protocol program. The runner used RPC simulation for attack transactions; it
did not submit theft transactions and did not target mainnet.

## Deployment Under Test

- Program: `mBQYJkivNJFT5egjQ2VGFb8sBMiaZMUr5GDNvKkxp1f`
- Program data address: `85LgYbQgLYNwykjBozVSbTUbo6hEKU5E4VcGsg1rEtxZ`
- Program data authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- Protocol governance PDA: `89jcsYbE9o4Km7BkDEJ4SfZph8jDwKyi1mHmV47KNjVa`
- Protocol governance authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- Merged main baseline: `63e6f4cc7a7a3b59ab1b8fa39cfa607cb78f9bfb`
- Strict run time: `2026-05-06T05:01:11.115Z`
- RPC: `https://api.devnet.solana.com/`

Deployment verification:

```sh
solana program show mBQYJkivNJFT5egjQ2VGFb8sBMiaZMUr5GDNvKkxp1f --url devnet
```

The deployed program is owned by `BPFLoaderUpgradeab1e11111111111111111111111`
and had program data authority `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
at verification time.

## Commands

The prior devnet program `BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s` was
closed to recover devnet rent after the public faucet became rate-limited. A
closed Solana program id cannot be reused, so the hardened replay deployed a
new devnet-only program id.

```sh
solana program close BtLPiswEfzwxenWM3GR6hihViZHpXLU6Pygw3nmH3B2s --url devnet --bypass-warning
OMEGAX_DEVNET_GOVERNANCE_MIN_LAMPORTS=0 npm run devnet:program:redeploy-fresh
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run protocol:bootstrap:devnet-live
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=100000000 npm run devnet:treasury:seed-canaries
npm run devnet:treasury:pen-test -- --strict --out-dir artifacts/devnet-security-rehearsal-post-merge-2026-05-06
```

The timestamped local evidence files for the strict run are:

- `artifacts/devnet-security-rehearsal-post-merge-2026-05-06/devnet-treasury-pen-test-2026-05-06T05-01-11-114Z.json`
- `artifacts/devnet-security-rehearsal-post-merge-2026-05-06/devnet-treasury-pen-test-2026-05-06T05-01-11-114Z.md`

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
| Raw SPL vault drain | `9EJu6mHkK5kJWSGpMd1pzzy9w5R4NnpVXqFseq2CVQq5:Ak2JkK4mfQfDjAL4t5H8HBxUfKDKmSWcFKb6jwFeBFJR` | blocked | Attacker is not vault token-account authority. |
| Raw SPL vault drain | `3pjm6M6oR3aTTRYj5jvxbXqYvNkTCMf9evUxF57zwwUY:GLuzSNNhnWVAi99sXvwq2gVTSUx9qN54phdjk9LH8J9W` | blocked | Attacker is not vault token-account authority. |
| Fee withdrawal to attacker | protocol fee vault `V9aqK6Y6Wm7rJw7pG65TDkrY7Do8oJUyLnZNePNH6RK` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool treasury vault `8yPEPPMxfNpVogjKoPe54SVdJrDf9XoWLe25H9bKcSxx` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool oracle fee vault `Ho7jE3cCPhDT3haAUSDWKBik1hY6KEW7ftgF4jKtYabL` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Linked claim settle to attacker | claim `3qDQZLrN2DJ5dRv7UyTjKi1WmL3u6WzBFVCVUcHmMQyY` | blocked | Attacker is not claim/operator authority and recipient is not member/delegate. |
| LP redemption to attacker | LP position `4yCkyNKkFU2G3kK1qYapeVShMDhjXxncywHzgsLJXtAU` | blocked | Attacker is not curator/governance and recipient is not LP owner. |
| Allocation obligation settle to attacker | obligation `FBrxjpe8b3gjG4iFwfbsDdVDoARmnhDgtY3xVeJw9hKw` | blocked | Attacker is not settlement controller and allocation ledgers bind to the obligation. |

## Notes

- Public devnet RPC returned intermittent `429 Too Many Requests`, but bootstrap
  and canary seeding completed through the retry wrapper.
- LP source token accounts were topped up with custom devnet SPL tokens before
  rerunning bootstrap; no real USDC or mainnet asset was used.
- The checked-in devnet manifest and frontend fixture JSON now point at
  `mBQYJkivNJFT5egjQ2VGFb8sBMiaZMUr5GDNvKkxp1f`.
- This run does not prove mainnet custody, multisig custody, or real reserve
  funding. It proves the strict treasury theft probes against the post-merge
  devnet binary.
