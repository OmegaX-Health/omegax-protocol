# Repository Layout

This repository keeps protocol code, public operator tooling, and public-facing artifacts in one monorepo.

## Top-level directories

- `programs/` contains the Anchor workspace and the on-chain protocol program
- `frontend/` contains the Next.js protocol console
- `scripts/` contains generation, verification, bootstrap, and devnet operator scripts
- `tests/` contains Node-based protocol, artifact, and frontend API tests
- `idl/` contains the checked-in Anchor IDL snapshot
- `shared/` contains generated protocol contract artifacts consumed by client implementations
- `android-native/` contains generated Android parity artifacts
- `docs/` contains public architecture, review, reference, and operations documentation

## Design principles

- Source code is primary; generated artifacts stay checked in only where they improve client parity and reviewability.
- Public docs live near the code they describe, with `docs/` acting as the repository index.
- Private infrastructure, secrets, and deployment state stay outside the repository.
- Verification scripts live in `scripts/` and are wired into CI to keep the public snapshot reproducible.

## Generated vs hand-edited content

Treat these directories as generated outputs unless a local README says otherwise:
- `idl/`
- `shared/`
- `android-native/protocol/`

Hand-edited source primarily lives in:
- `programs/omegax_protocol/src/`
- `frontend/app/`
- `frontend/components/`
- `frontend/lib/`
- `scripts/`
- `tests/`

## Why the repo stays monorepo-shaped

The protocol program, web console, tests, and generated artifacts change together frequently. Keeping them together makes it easier to:
- review protocol changes alongside UI and artifact updates
- run consistency checks from one clone
- expose one canonical public source repository for hosted deployments

The SDK remains separate because its job is distribution and integration, not operating the full protocol surface.
