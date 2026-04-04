# Liquidity Pool Metadata Schema

This document defines the optional off-chain metadata JSON used for LP-facing `LiquidityPool` APY display.

## Purpose

- keep estimated APY off-chain and informational
- keep NAV, reserve, and liability truth on-chain
- allow a liquidity pool to publish APY methodology and timestamp references without changing on-chain account layouts

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

- `schema` is optional, but when present it must remain `"omegax.pool"` for compatibility
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

- This schema is for LP-facing estimate display, not guarantees.
- Reserve truth, claims, obligations, and redeemable capital should still come from on-chain ledgers and readers.
- The JSON shape keeps the historical schema string for compatibility, but the economic object it describes is a `LiquidityPool`, not a sponsor program.
