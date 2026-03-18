# Documentation

This directory contains the public documentation set for `omegax-protocol`.

## Sections

### Architecture

- [Repository Layout](./architecture/repository-layout.md)
- [Solana Program Architecture](./architecture/solana-program-architecture.md)
- [Solana Instruction Map](./architecture/solana-instruction-map.md)
- [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md)
- [Frontend Information Architecture](./architecture/frontend-information-architecture.md)

### Reviews

- [Solana Public Readiness Review (March 10, 2026)](./reviews/solana-public-readiness-review.md)

### Reference

- [Pool Metadata Schema](./reference/pool-metadata-schema.md)

### Testing

- [Protocol Surface Audit](./testing/protocol-surface-audit.md)

### Operations

- [Devnet Beta Runbook](./operations/devnet-beta-runbook.md)
- [Public Release Gate](./operations/public-release-gate.md)
- [Firebase App Hosting Cutover](./operations/firebase-app-hosting-cutover.md)

### Public Site

- [OmegaX Docs](https://docs.omegax.health/docs)
- [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax)
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)

## Audience Guide

- Use [OmegaX Docs](https://docs.omegax.health/docs) when you want the polished public overview, product story, and external documentation hub rather than repo-specific workflow details.
- Use [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax) when you need the clearest public statement of the protocol’s purpose, problem framing, and long-range destination.
- Start with [Repository Layout](./architecture/repository-layout.md) if you are new to the repo.
- Use [Solana Program Architecture](./architecture/solana-program-architecture.md) to understand the on-chain program layout and reviewer read order.
- Use [Solana Instruction Map](./architecture/solana-instruction-map.md) when tracing an instruction from entrypoint to handler, accounts, and helpers.
- Use [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md) when you need the signer model, claim roles, and payout-path rules for reviewed coverage claims.
- Use [Solana Public Readiness Review](./reviews/solana-public-readiness-review.md) for the scored audit, blockers, and cleanup backlog.
- Use [Pool Metadata Schema](./reference/pool-metadata-schema.md) when integrating off-chain pool metadata.
- Use [Protocol Surface Audit](./testing/protocol-surface-audit.md) when you need the heavier localnet proof for instruction coverage, error coverage, and release-candidate sign-off.
- Use [Devnet Beta Runbook](./operations/devnet-beta-runbook.md) for structured devnet beta operations.
- Use [Public Release Gate](./operations/public-release-gate.md) for the repo-only verification baseline and release-candidate sign-off workflow.
- Use [Firebase App Hosting Cutover](./operations/firebase-app-hosting-cutover.md) when preparing GitHub-connected hosting from this public repo.

For directory-specific guidance, also see:
- [../e2e/README.md](../e2e/README.md)
- [../frontend/README.md](../frontend/README.md)
- [../scripts/README.md](../scripts/README.md)
- [../programs/README.md](../programs/README.md)
- [../tests/README.md](../tests/README.md)
