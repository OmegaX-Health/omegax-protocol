# OmegaX Protocol

OmegaX Protocol is the shared onchain health-plan foundation for OmegaX.

It puts plan rights, liabilities, reserves, claims, and settlement truth on Solana while keeping sensitive health data, evidence handling, and operational workflow around the protocol.

This repository is the public source of truth for the protocol codebase. It contains the on-chain Solana program, the web-based protocol console, checked-in interface artifacts, release and operator runbooks, and protocol-focused verification coverage.

## Overview

- sponsors and operators can configure plans, policies, rules, and capital controls against one shared settlement layer
- members and wallets can verify rights, claims, payouts, and capital state against public protocol objects
- builders can integrate against a checked-in IDL and generated contract artifacts instead of opaque private workflows

## Who This Repo Is For

- contributors and reviewers who need the source of truth for the onchain program and protocol-facing frontend
- integrators who need the checked-in IDL, generated artifacts, and verification-backed public contract surface
- operators who need public-safe runbooks, deployment templates, and reproducible verification steps

## Vision

OmegaX is building open infrastructure for health-related rights, liabilities, settlement, and capital flows. The long-range goal is not a closed rewards app or a single operator console. It is one shared protocol foundation that sponsors, members, capital providers, oracles, and builders can all use.

That public story is now documented more clearly in the external docs hub, while this repository stays focused on the code, artifacts, and release discipline behind that story.

## Status

- Release target: `0.2.0`
- Repository license: `AGPL-3.0-or-later`
- SDK license: `Apache-2.0` in the separate `omegax-sdk` repository
- Repository stewardship: `OMEGAX HEALTH FZCO and contributors`
- Names, logos, and official branding remain subject to [TRADEMARKS.md](./TRADEMARKS.md)
- CI in this repository is verification-only and does not deploy infrastructure
- Hosted frontend rollout is intentionally out of scope for the `0.2.0` release gate

## What belongs here

- On-chain protocol code and checked-in IDL
- Public web console and client-safe configuration templates
- Generated protocol contract artifacts consumed by clients
- Test coverage for protocol behavior, web APIs, and artifact parity
- Public docs, runbooks, and repository metadata

## What does not belong here

- Private backend services
- Hosting secrets or deployment-only config
- Local validator state, key material, or machine-specific output
- Canonical production control-plane automation

## Start Here

- [OmegaX Introduction](https://docs.omegax.health/docs) for the polished public overview
- [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax) for the problem statement and long-range purpose
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture) for the system model and boundary rules
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface) for the current public protocol surface
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production) for the oracle and event-production model
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started) for external integration entrypoints

## Quick Start

### Install

```bash
npm ci
npm --prefix frontend ci
```

### Local development

```bash
npm run frontend:dev
```

### Run the protocol test suite

```bash
npm run test:node
```

### Run the heavy localnet E2E matrix

```bash
npm run test:e2e:localnet
```

This command runs the checked build, boots a fresh `solana-test-validator`, executes the sequential protocol-surface matrix, and writes a timestamped JSON summary to `artifacts/localnet-e2e-summary-*.json`.
The matrix currently proves all `85` public instructions, including a preloaded legacy-schema migration path for `backfill_schema_dependency_ledger`.

Useful debug env vars:
- `OMEGAX_E2E_SKIP_BUILD=1` reuses the current checked build
- `OMEGAX_E2E_KEEP_ARTIFACTS=1` preserves validator logs and the JSON summary under `artifacts/`
- `OMEGAX_E2E_SCENARIO=<name>` reruns a single scenario family against a fresh local validator

The localnet matrix is intentionally separate from `test:node`, `anchor:test`, and public CI. Coverage and exception policy are enforced through `e2e/support/surface_manifest.ts`: every public instruction must be assigned to a scenario, and every surfaced custom error must be observed or explicitly exception-listed with a reason.

### Run public-repo verification

```bash
npm run verify:public
```

This verifies:
- Rust formatting, unit tests, and lint baseline
- generated protocol contract sync
- Node-based protocol and frontend API tests
- frontend production build
- tracked-file hygiene
- dependency license policy

For public release candidates, add `npm run test:e2e:localnet` as a separate sign-off step. The baseline and release-candidate workflows are documented in [docs/operations/public-release-gate.md](./docs/operations/public-release-gate.md).

## Repository Guide

- [docs/README.md](./docs/README.md) explains the public documentation set
- [docs.omegax.health/docs](https://docs.omegax.health/docs) is the polished public docs hub
- [frontend/README.md](./frontend/README.md) explains the protocol console
- [e2e/README.md](./e2e/README.md) explains the heavier localnet protocol-surface matrix
- [scripts/README.md](./scripts/README.md) explains verification, generation, and operator scripts
- [programs/README.md](./programs/README.md) explains the on-chain workspace
- [tests/README.md](./tests/README.md) explains the test suite
- [idl/README.md](./idl/README.md) explains the checked-in IDL snapshot
- [shared/README.md](./shared/README.md) explains generated shared protocol artifacts
- [android-native/README.md](./android-native/README.md) explains Android parity artifacts

## Public Docs vs Repo Docs

- use `docs.omegax.health` for the public narrative, protocol purpose, architecture, markets, oracle model, coverage model, and SDK onboarding
- use this repository’s markdown docs for repo-specific release gates, review paths, schemas, local verification, and operator-safe configuration
- use the checked-in code and generated artifacts here when you need the implementation truth behind the public docs

## Documentation Map

### Architecture

- [Repository Layout](./docs/architecture/repository-layout.md)
- [Solana Program Architecture](./docs/architecture/solana-program-architecture.md)
- [Solana Instruction Map](./docs/architecture/solana-instruction-map.md)
- [Frontend Information Architecture](./docs/architecture/frontend-information-architecture.md)

### Reviews

- [Solana Public Readiness Review (March 10, 2026)](./docs/reviews/solana-public-readiness-review.md)

### Reference

- [Pool Metadata Schema](./docs/reference/pool-metadata-schema.md)

### Testing

- [Protocol Surface Audit](./docs/testing/protocol-surface-audit.md)

### Operations

- [Devnet Beta Runbook](./docs/operations/devnet-beta-runbook.md)
- [Public Release Gate](./docs/operations/public-release-gate.md)

### Public Site

- [OmegaX Docs](https://docs.omegax.health/docs)
- [Introduction](https://docs.omegax.health/docs)
- [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax)
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)

## Environment and Hosting

Use the checked-in deployment config and templates only:
- `firebase.json`
- `frontend/.env.example`
- `frontend/apphosting.yaml`

Never commit:
- `.firebaserc`
- `frontend/.env.local`
- `frontend/apphosting.local.yaml`
- private keys, service tokens, or local validator data

Important notes:
- `NEXT_PUBLIC_*` values are public client configuration
- `.firebaserc` should stay local so this public repo never tracks Firebase project aliases
- hosted deployments should keep the in-app source link pointed at the exact public repository or release being served
- `frontend/apphosting.yaml` is safe to publish because the current deployment only uses public runtime configuration

## Common Commands

- `npm run protocol:contract` regenerates checked-in protocol artifacts
- `npm run protocol:contract:check` validates artifact sync
- `npm run rust:fmt:check` checks Rust formatting
- `npm run rust:test` runs Solana program unit tests
- `npm run rust:lint` runs the Anchor-compatible Clippy baseline
- `npm run frontend:build` builds the web console
- `npm run public:hygiene:check` blocks tracked secrets, junk, and private references
- `npm run license:audit` checks npm and Cargo dependency licenses
- `npm run anchor:build` builds the Anchor program
- `npm run anchor:test` runs Anchor tests with the stack-warning gate
- `npm run test:e2e:localnet` boots `solana-test-validator` and runs the localnet protocol-surface matrix

For repo-only public readiness, the release boundary ends at `npm run verify:public`.

## Governance, Security, and Community

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [TRADEMARKS.md](./TRADEMARKS.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [AUTHORS.md](./AUTHORS.md)
- [LICENSE](./LICENSE)

## Public-Repo Expectations

This repository is intended to be understandable from a fresh clone:
- directories explain themselves with local README files
- generated artifacts are clearly labeled
- public docs are grouped by purpose
- deployment secrets remain outside the repository

Canonical deployment and operational credentials remain managed separately.

Maintained by OMEGAX HEALTH FZCO with open-source contributors. Project initiated by Marino Sabijan, MD.
