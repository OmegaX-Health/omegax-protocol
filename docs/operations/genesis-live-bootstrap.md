# Genesis Live Bootstrap

Use this operator flow when you need to seed the real Genesis Protect Acute launch surface on a live cluster instead of the shared devnet demo matrix.

This helper is intentionally Genesis-only:

- one reserve domain
- one Genesis plan
- Event 7 and Travel 30 policy series
- Event 7 sponsor, premium, and liquidity lines
- Travel 30 premium and liquidity lines
- Genesis pool with senior and junior first-loss classes
- canonical Genesis oracle and verified schema wiring

It does not deploy the Solana program for you. The target cluster must already have the canonical program id deployed and the governance signer must already be funded.

## Command

Preview the derived launch addresses and required inputs without sending transactions:

```bash
npm run protocol:bootstrap:genesis-live -- --plan
```

Execute the live bootstrap:

```bash
npm run protocol:bootstrap:genesis-live
```

## Required environment

Set these in the shell before running the command:

```bash
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
export OMEGAX_LIVE_SETTLEMENT_MINT=<usdc_mint>
export OMEGAX_LIVE_ORACLE_WALLET=<oracle_pubkey>
export OMEGAX_LIVE_ORACLE_KEYPAIR_PATH=/absolute/path/to/oracle-keypair.json
export OMEGAX_GENESIS_SETTLEMENT_VAULT_TOKEN_ACCOUNT=<treasury_token_account>
export OMEGAX_GENESIS_GOVERNANCE_SETTLEMENT_SOURCE_TOKEN_ACCOUNT=<governance_source_token_account>
```

The governance signer defaults to `~/.config/solana/id.json`. Override it with `SOLANA_KEYPAIR` when needed.

If the senior or junior LP seed deposits are enabled, also set
`OMEGAX_GENESIS_SENIOR_LP_SETTLEMENT_SOURCE_TOKEN_ACCOUNT` and
`OMEGAX_GENESIS_JUNIOR_LP_SETTLEMENT_SOURCE_TOKEN_ACCOUNT`. Source token accounts must be distinct
from `OMEGAX_GENESIS_SETTLEMENT_VAULT_TOKEN_ACCOUNT`; bootstrap funding now performs checked SPL
token transfers before reserve ledgers increase.

## Optional role overrides

If Genesis launch operations use dedicated wallets instead of the governance wallet, set:

```bash
export OMEGAX_LIVE_SPONSOR_WALLET=<pubkey>
export OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET=<pubkey>
export OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET=<pubkey>
export OMEGAX_LIVE_POOL_CURATOR_WALLET=<pubkey>
export OMEGAX_LIVE_POOL_ALLOCATOR_WALLET=<pubkey>
export OMEGAX_LIVE_POOL_SENTINEL_WALLET=<pubkey>
export OMEGAX_LIVE_MEMBERSHIP_INVITE_AUTHORITY=<pubkey>
export GOVERNANCE_CONFIG=<governance_pda_pubkey>
```

If `OMEGAX_LIVE_MEMBERSHIP_INVITE_AUTHORITY` is omitted, the plan is seeded in open-membership mode.

## Optional launch funding

These amounts are base-unit integers for the settlement mint:

```bash
export OMEGAX_LIVE_EVENT7_SPONSOR_BUDGET_AMOUNT=<amount>
export OMEGAX_LIVE_EVENT7_PREMIUM_AMOUNT=<amount>
export OMEGAX_LIVE_TRAVEL30_PREMIUM_AMOUNT=<amount>
export OMEGAX_LIVE_SENIOR_CLASS_DEPOSIT_AMOUNT=<amount>
export OMEGAX_LIVE_SENIOR_LP_KEYPAIR_PATH=/absolute/path/to/senior-lp.json
export OMEGAX_LIVE_JUNIOR_CLASS_DEPOSIT_AMOUNT=<amount>
export OMEGAX_LIVE_JUNIOR_LP_KEYPAIR_PATH=/absolute/path/to/junior-lp.json
export OMEGAX_LIVE_EVENT7_JUNIOR_ALLOCATION_AMOUNT=<amount>
export OMEGAX_LIVE_TRAVEL30_SENIOR_ALLOCATION_AMOUNT=<amount>
export OMEGAX_LIVE_TRAVEL30_JUNIOR_ALLOCATION_AMOUNT=<amount>
```

Leaving these unset creates the structure without claiming that reserve lanes are already funded.

## Canonical defaults

Unless overridden, the helper uses the same public Genesis shape already shipped in the protocol console and metadata:

- reserve domain id: `open-health-usdc`
- plan id: `genesis-protect-acute-v1`
- pool id: `genesis-protect-acute-pool`
- classes: `genesis-senior-class`, `genesis-junior-class`
- Event 7 junior allocation weight: `2175`
- Travel 30 senior allocation weight: `4350`
- Travel 30 junior allocation weight: `3475`
- schema key: `genesis-protect-acute-claim`
- schema metadata file: `frontend/public/schemas/genesis-protect-acute-claim-v1.json`

## Honest stop conditions

This helper will stop early when:

- the canonical program id is not deployed on the target cluster
- the governance signer has no lamports on the target cluster
- the oracle public key does not match the provided oracle keypair file
- LP deposit amounts are set without the corresponding LP keypair path
- the protocol governance authority has already rotated away from the direct signer and a direct schema backfill would be unsafe

Those failures are deliberate. They prevent the repo from pretending Genesis is live when the target chain or operator credentials are not actually ready.
