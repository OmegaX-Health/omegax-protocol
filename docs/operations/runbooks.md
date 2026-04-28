# Operator Runbooks — Index

Single index for the operator runbooks under `docs/operations/`. Use the role × environment table below to find the canonical entry point for the work you're doing, then follow the linked runbook for the full sequence and any environment-specific guards.

This page does not replace the individual runbooks — they remain the canonical source for their respective flows. This is a navigation layer so a contributor can find the right runbook without reading four READMEs.

## Role × environment quickstart

| Role | Environment | Entry point | Runbook |
|------|-------------|-------------|---------|
| Reviewer / contributor | Local working tree | `make verify` (or `npm run verify:public`) | [public-release-gate.md](./public-release-gate.md) |
| Reviewer / contributor | Local working tree, protocol-touching change | `npm run test:e2e:localnet` | [public-release-gate.md](./public-release-gate.md) |
| Devnet operator | Shared devnet beta | `npm run devnet:beta:deploy` → `npm run protocol:bootstrap:devnet-live` → `npm run devnet:frontend:bootstrap` | [devnet-beta-runbook.md](./devnet-beta-runbook.md) |
| Devnet operator | Devnet observability sweep | `npm run devnet:beta:observe` | [devnet-beta-runbook.md](./devnet-beta-runbook.md) |
| Devnet operator | Drawer simulation (no state mutation) | `npm run devnet:operator:drawer:sim` | [devnet-beta-runbook.md](./devnet-beta-runbook.md#operator-drawer-simulation) |
| Mainnet operator | Genesis live bootstrap (preview) | `npm run protocol:bootstrap:genesis-live -- --plan` | [genesis-live-bootstrap.md](./genesis-live-bootstrap.md) |
| Mainnet operator | Genesis live bootstrap (apply) | `npm run protocol:bootstrap:genesis-live` (with `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1`) | [genesis-live-bootstrap.md](./genesis-live-bootstrap.md) |
| Hosting operator | Firebase App Hosting cutover | follow the cutover checklist | [firebase-app-hosting-cutover.md](./firebase-app-hosting-cutover.md) |
| Release manager | Public-tag promotion | walk the gate, then publish notes | [public-release-gate.md](./public-release-gate.md) + [release-v0.3.1.md](./release-v0.3.1.md) |
| Anyone touching the on-chain surface | Local | `npm run anchor:idl` then `npm run protocol:contract` then `npm run idl:freshness:check` | [public-release-gate.md](./public-release-gate.md#generated-artifacts) |

## Pre-flight: required environment

These environment-variable expectations are enforced by the underlying scripts, but new operators commonly hit the missing-variable wall first. The list below is the union — see each runbook for which subset applies.

- `SOLANA_KEYPAIR` — operator keypair path. Defaults to `~/.config/solana/id.json`.
- `OMEGAX_LIVE_ORACLE_WALLET`, `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH` — Genesis live oracle wallet pair (mainnet bootstrap).
- `OMEGAX_LIVE_SETTLEMENT_MINT` — settlement asset mint for the live cluster (mainnet bootstrap).
- `OMEGAX_DEVNET_*_VAULT_TOKEN_ACCOUNT` — devnet treasury custody token accounts (devnet bootstrap).
- `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1` — enforces role separation in Genesis live bootstrap; required for mainnet.
- `NEXT_PUBLIC_GOVERNANCE_REALM`, `NEXT_PUBLIC_GOVERNANCE_CONFIG`, `NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT` — frontend governance wiring; loaded from `frontend/.env.local`.

The `scripts/CLAUDE.md` file is explicit that bootstrap, deploy, and devnet governance scripts may mutate on-chain state — never run them unless the operator/contributor explicitly intends to.

## Generated artifacts

When the on-chain program surface changes, regenerate the checked-in artifacts so SDKs downstream stay in sync:

```bash
npm run anchor:idl              # rebuilds + copies idl/omegax_protocol.json + writes idl/omegax_protocol.source-hash
npm run protocol:contract       # regenerates shared/protocol_contract.json, frontend/lib/generated/, android-native/protocol/
npm run idl:freshness:check     # CI-mirrored guard: fails if program source drifted from the checked-in IDL
npm run protocol:contract:check # CI-mirrored guard: fails if generated downstreams drifted from the IDL
```

CI runs `idl:freshness:check` and `protocol:contract:check` automatically (see `.github/workflows/ci.yml`). The Localnet E2E workflow (`.github/workflows/localnet-e2e.yml`) runs the full e2e matrix on protocol-touching PRs.

## Public-safety guardrails

- Never commit secrets, private keys, deployment-only env files, or local validator artifacts to this repo. The `npm run public:hygiene:check` gate looks for the most common patterns.
- The Genesis vanity wallet `oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h` is public-safe; the corresponding private keypair is **not**. See `CLAUDE.md` Genesis Protect Launch Keys for the env-var contract.
- `idl/`, `shared/protocol_contract.json`, `frontend/lib/generated/`, and `android-native/protocol/` are generated artifacts — do not hand-edit unless a documented maintenance workflow explicitly requires it.

## Related references

- [`README.md`](../../README.md) — repo entry point
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — DCO, dep policy, PR expectations
- [`scripts/README.md`](../../scripts/README.md) — full script catalog (operator + verification tooling)
- [`docs/testing/protocol-surface-audit.md`](../testing/protocol-surface-audit.md) — canonical scenario coverage matrix
- [`docs/operations/dependency-advisory-risk-acceptance.md`](./dependency-advisory-risk-acceptance.md) — accepted advisories
