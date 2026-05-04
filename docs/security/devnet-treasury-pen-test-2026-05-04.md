# Devnet Treasury Penetration Test — 2026-05-04

**Scope:** authorized devnet-only treasury theft attempt against the public OmegaX protocol deployment.  
**Program:** `Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B` on Solana devnet.  
**Runner:** `npm run devnet:treasury:pen-test` (`scripts/devnet_treasury_pen_test.ts`).  
**Run time:** `2026-05-04T05:44:59Z`.
**Canary seed:** `npm run devnet:treasury:seed-canaries` created a live
linked-claim obligation canary before this run. Governance-gated fee-vault and
LP-redemption canaries were skipped because the configured local signer does
not match the deployed protocol governance authority.

## Method

The runner generates an in-memory attacker wallet and performs non-mutating
devnet simulations only. It does not send the attack transactions and does not
read or write any operator keypair files.

Because the devnet faucet returned intermittent internal errors during this
run, the simulation uses a funded public devnet account as the fee payer and
keeps the attacker wallet as the authority/recipient inside the attack
instructions. Signature verification is intentionally disabled by RPC
simulation; the instruction-level signer bits still execute the same
authorization path, and no state changes are committed.

Attack classes:

1. Raw SPL transfer from live `DomainAssetVault.vault_token_account` to an attacker ATA.
2. OmegaX fee-vault withdrawal to an attacker-owned token account.
3. OmegaX linked-claim obligation settlement to an attacker-owned token account.
4. OmegaX LP redemption processing to an attacker-owned token account.

## Result

**No simulated theft path succeeded.**

Summary from the devnet run:

```json
{
  "counts": {
    "blocked": 7,
    "vulnerable": 0,
    "skipped": 2,
    "inconclusive": 0
  }
}
```

The blocked probes were six raw SPL vault-drain attempts against live vault
token accounts plus one OmegaX linked-claim settlement attempt against the
seeded canary obligation. Raw SPL drains failed at the SPL Token program with
owner mismatch; the linked-claim settlement failed in OmegaX auth because the
attacker was not the claim/operator authority.

## Devnet Coverage Gaps

The live devnet deployment did not expose enough initialized post-Phase 1.7
state to complete every treasury theft path:

- `protocolFeeVaults`: `0`
- `poolTreasuryVaults`: `0`
- `poolOracleFeeVaults`: `0`
- live unsettled linked-claim obligation with usable vault token account:
  seeded and blocked by the pen-test
- live LP position with pending redemption shares: none

That means this run proves the raw SPL custody boundary and the linked-claim
settlement authority boundary against live initialized devnet state. Fee
withdrawal and LP redemption still need governance-authorized canaries.

## Notable Devnet State

The live snapshot contained nine `DomainAssetVault` accounts, but several
legacy vault rows still have `vaultTokenAccount =
11111111111111111111111111111111` while carrying non-zero `totalAssets`.
Those rows are not directly stealable through the current runner, but they are
a devnet parity smell: they cannot exercise the current PDA-owned SPL outflow
model.

## Follow-Up

Before treating devnet as a full treasury-security rehearsal, initialize the
current fee-vault rails and create the remaining outflow canaries:

- one protocol fee vault with accrued SPL fees
- one pool treasury vault with accrued SPL fees
- one pool oracle fee vault with accrued SPL fees
- one LP position with pending redemption shares

Then rerun:

```sh
npm run devnet:treasury:seed-canaries
npm run devnet:treasury:pen-test
```

The runner exits non-zero if any simulated theft succeeds.
