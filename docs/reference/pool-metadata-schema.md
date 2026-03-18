# Pool Metadata Schema

This document defines the off-chain metadata JSON used for DeFi-facing pool metrics.

## Purpose

- keep estimated APY off-chain and informational
- keep TVL on-chain derived
- allow pools to publish APY methodology and timestamp references without changing on-chain account layouts

## Minimal Schema

```json
{
  "schema": "omegax.pool",
  "version": 1,
  "defi": {
    "apyBps": 1250,
    "apyWindowDays": 30,
    "apyAsOfTs": 1730000000,
    "apyMethodologyUri": "https://docs.omegax.health/methodology/liquidity-apy"
  }
}
```

## Field Rules

- `schema` is optional, but when present it must be `"omegax.pool"`
- `version` is optional, but when present it must be `1`
- `defi.apyBps` is required for APY display and must be an integer in basis points
- `defi.apyWindowDays` is optional and should be an integer in the range `1..3650`
- `defi.apyAsOfTs` is optional and should be a positive Unix timestamp in seconds
- `defi.apyMethodologyUri` is optional and should be a valid `http(s)` or `ipfs://` URI

## Behavior When Fields Are Missing

- If `defi` is missing, APY is treated as unavailable.
- If `defi` exists but `apyBps` is missing, APY is treated as unavailable.
- If APY fields are invalid, APY is rejected and the UI shows no APY value.

## Notes

- This schema is designed for LP-facing estimate display, not guarantees.
- TVL should be computed from on-chain balances such as `Pool` lamports or SPL vault balances.
