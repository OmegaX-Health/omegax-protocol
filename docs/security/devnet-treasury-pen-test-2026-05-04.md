# Devnet Treasury Penetration Test - 2026-05-04

## Scope

Authorized devnet-only treasury theft rehearsal against the current OmegaX
protocol program. The runner used RPC simulation for attack transactions; it
did not submit theft transactions and did not target mainnet.

## Deployment Under Test

- Program: `3autasvKVhr7XtEtCrMwvELHMcgkSznNXRdzAe1FuCNX`
- Program data authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- Protocol governance PDA: `7rjTAckGY9PMTGH43B2pG3DC7czbLazF3LN3QaKnejty`
- Protocol governance authority: `CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU`
- RPC: `https://api.devnet.solana.com/`
- Strict run time: `2026-05-04T09:15:59.779Z`

Deployment verification:

```sh
solana program show 3autasvKVhr7XtEtCrMwvELHMcgkSznNXRdzAe1FuCNX --url devnet
```

The deployed program is owned by `BPFLoaderUpgradeab1e11111111111111111111111`
and had program data authority
`CsBxTVjC4Y8oWuoU9xdp91du7WCaQWEbGyNBTuc7weDU` at verification time.

## Commands

```sh
npm run devnet:program:redeploy-fresh
npm run anchor:idl
npm run protocol:contract
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=0 npm run protocol:bootstrap:devnet-live
OMEGAX_DEVNET_ROLE_MIN_LAMPORTS=0 npm run devnet:treasury:seed-canaries
npm run devnet:treasury:pen-test -- --strict --out-dir artifacts/devnet-security-rehearsal-full-bootstrap
```

The timestamped local evidence files for the strict run are:

- `artifacts/devnet-security-rehearsal-full-bootstrap/devnet-treasury-pen-test-2026-05-04T09-15-59-778Z.json`
- `artifacts/devnet-security-rehearsal-full-bootstrap/devnet-treasury-pen-test-2026-05-04T09-15-59-778Z.md`

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
| Raw SPL vault drain | `GUt2SdFK1SDcBw4mBTJoF4GX3nLKNVU8Hz6mCcaCMxD8:AbPybY6PHwLLnnCb22qNafwZuB8GcFxkcimZxiH9C6kn` | blocked | Attacker is not vault token-account authority. |
| Raw SPL vault drain | `3nTS89pYbsR26hBxqK2hUwTQxqha5cgaujs8fLsXgJcR:Ci4MNGKvr8Bg6h4Qmn9DJq5hM2fR4zgDNccjVKrJkTer` | blocked | Attacker is not vault token-account authority. |
| Fee withdrawal to attacker | protocol fee vault `EB7ENqp29Mdd7m1Lrxdukmw6b6QNK1oS2LjvrNegBXdi` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool treasury vault `6ELshgz8a6iGd9uZnefJ8egeskYcJff2fJQTFL1WfbBi` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Fee withdrawal to attacker | pool oracle fee vault `AR5M6BYfyXpeAHygttEQAwZshfYtrszTYSSFURecj2pW` | blocked | Attacker signer and attacker-owned recipient are rejected. |
| Linked claim settle to attacker | claim `k3qrVYaN6iBgnuHhGEP2oXCBq5cLXedzSAuYrDAaRLV` | blocked | Attacker is not claim/operator authority and recipient is not member/delegate. |
| LP redemption to attacker | LP position `GsYNHrsbin8tGuNfdZCqAdR6pDLaajSzhKJr2NNwbfVS` | blocked | Attacker is not curator/governance and recipient is not LP owner. |
| Allocation obligation settle to attacker | obligation `FssKgX1yo8zSwxyLijnvsTQPCZ2qeZDcYrbgZ2s2R3PA` | blocked | Attacker is not settlement controller and allocation ledgers bind to the obligation. |

## Rehearsal Findings Fixed

The rehearsal uncovered a real settlement accounting defect before the final
strict run: allocation-scoped obligation settlement could underflow because
logical allocation capacity was being settled through the same funded-custody
path as physical domain/pool vault accounting. The program now uses
allocation-style settlement for plan, funding-line, series, and allocation
capacity ledgers while keeping domain and pool ledgers as physical funded
custody debits.

The linked-claim obligation canary also required pool-oracle fee accrual on
`settle_obligation`. That path now validates the pool oracle fee vault, policy,
and claim attestation bindings before accruing oracle fees and transferring net
settlement funds.

## Fixture Parity

After the first strict treasury run, devnet SOL was rebalanced between local
role wallets and the full live bootstrap completed for the same final program.
The checked-in devnet manifest and frontend fixture JSON now point at
`3autasvKVhr7XtEtCrMwvELHMcgkSznNXRdzAe1FuCNX`.

The stable rails remain simulated with devnet SPL mints. The current settlement
and reward mints are local devnet test mints, not real USDC or real reward
assets.
