# Documentation

This directory contains the public documentation set for `omegax-protocol`.

If you are an external builder, start with the public docs site before diving into the repo-internal architecture notes here.

## External builder start here

- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.omegax.health/docs/sdk/sdk-workflows)
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture)

## Sections

### Architecture

- [Repository Layout](./architecture/repository-layout.md)
- [Solana Program Architecture](./architecture/solana-program-architecture.md)
- [Solana Instruction Map](./architecture/solana-instruction-map.md)
- [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md) — abstract claim model
- [Genesis Protect Claim Trace](./architecture/genesis-protect-claim-trace.md) — deterministic end-to-end walkthrough + messy-path map
- [Genesis Protect V1 Curve Launch Plan](./architecture/genesis-protect-v1-curve-launch.md) — accepted V1 launch recommendation for curve-priced Travel 30, reserve gating, and Phase 0 claims
- [Frontend Information Architecture](./architecture/frontend-information-architecture.md)
- [Protocol Console Functional Specification](./architecture/protocol-console-functional-spec.md)

### Reviews

- [Solana Public Readiness Review (March 10, 2026)](./reviews/solana-public-readiness-review.md)

### Reference

- [Liquidity Pool Metadata Schema](./reference/liquidity-pool-metadata-schema.md)

### Examples

- [Non-Canonical Protocol Examples](../examples/README.md)

### Testing

- [Protocol Surface Audit](./testing/protocol-surface-audit.md)

### Operations

- [Operator Runbooks — Index](./operations/runbooks.md) — start here for role × environment routing
- [Devnet Beta Runbook](./operations/devnet-beta-runbook.md)
- [Genesis Live Bootstrap](./operations/genesis-live-bootstrap.md)
- [Public Release Gate](./operations/public-release-gate.md) — `verify:public` is repo baseline; production promotion needs the evidence template
- [Release-Candidate Evidence Template](./operations/release-candidate-evidence-template.md) — fill in before public-tag or mainnet promotion
- [Firebase App Hosting Cutover](./operations/firebase-app-hosting-cutover.md)
- [Dependency Advisory Risk Acceptance](./operations/dependency-advisory-risk-acceptance.md)
- [Release v0.3.0](./operations/release-v0.3.0.md)
- [Release v0.3.1](./operations/release-v0.3.1.md)

### Security

- [Mainnet Privileged-Role Controls](./security/mainnet-privileged-role-controls.md) — role matrix, multisig requirement, break-glass exception, rotation, incident recovery
- [Pre-Mainnet Pen-Test (2026-04-27)](./security/pre-mainnet-pen-test-2026-04-27.md)

### Public Site

- [OmegaX Docs](https://docs.omegax.health/docs)
- [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview)
- [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started)
- [SDK Workflows](https://docs.omegax.health/docs/sdk/sdk-workflows)
- [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production)
- [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface)
- [Protocol Architecture](https://docs.omegax.health/docs/protocol/architecture)
- [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax)

## Audience Guide

- Use [SDK Overview](https://docs.omegax.health/docs/sdk/sdk-overview) when you want the fastest public explanation of what builders can ship on OmegaX today.
- Use [SDK Getting Started](https://docs.omegax.health/docs/sdk/sdk-getting-started) when you want to connect a client and choose the right builder workflow on devnet beta.
- Use [Oracle Event Production](https://docs.omegax.health/docs/oracle/event-production) when you are designing an oracle, signal-normalization layer, or event pipeline.
- Use [What Exists Today](https://docs.omegax.health/docs/protocol/current-program-surface) when you need the current public protocol boundary before reading repo internals.
- Use [OmegaX Docs](https://docs.omegax.health/docs) when you want the polished public overview, product story, and external documentation hub rather than repo-specific workflow details.
- Use [Why OmegaX](https://docs.omegax.health/docs/thesis/why-omegax) when you need the clearest public statement of the protocol’s purpose and long-range destination.
- Start with [Repository Layout](./architecture/repository-layout.md) if you are new to the repo and need the internal file map.
- Use [Solana Program Architecture](./architecture/solana-program-architecture.md) to understand the on-chain program layout and reviewer read order.
- Use [Solana Instruction Map](./architecture/solana-instruction-map.md) when tracing an instruction from entrypoint to handler, accounts, and helpers.
- Use [Decentralized Coverage Claims](./architecture/decentralized-coverage-claims.md) when you need the signer model, claim roles, and payout-path rules for reviewed coverage claims.
- Use [Genesis Protect V1 Curve Launch Plan](./architecture/genesis-protect-v1-curve-launch.md) when deciding what to ship first on mainnet after the quote-curve, sidecar, prediction-market, and health-bond actuarial review.
- Use [Protocol Console Functional Specification](./architecture/protocol-console-functional-spec.md) when you need the target-state screen-by-screen functional brief for the public protocol console.
- Use [Solana Public Readiness Review](./reviews/solana-public-readiness-review.md) for the scored audit, blockers, and cleanup backlog.
- Use [Liquidity Pool Metadata Schema](./reference/liquidity-pool-metadata-schema.md) when integrating LP-facing off-chain APY metadata for a `LiquidityPool`.
- Use [Protocol Surface Audit](./testing/protocol-surface-audit.md) when you need the heavier localnet proof for canonical instruction ownership, scenario coverage, and release-candidate sign-off.
- Start with [Operator Runbooks — Index](./operations/runbooks.md) when you need to find the right runbook for a role × environment without reading every operations doc.
- Use [Devnet Beta Runbook](./operations/devnet-beta-runbook.md) for structured devnet beta operations.
- Use [Genesis Live Bootstrap](./operations/genesis-live-bootstrap.md) when seeding the live Genesis Protect Acute launch surface on a real cluster.
- Use [Public Release Gate](./operations/public-release-gate.md) for the repo-only verification baseline and release-candidate sign-off workflow.

For directory-specific guidance, also see:
- [../e2e/README.md](../e2e/README.md)
- [../frontend/README.md](../frontend/README.md)
- [../scripts/README.md](../scripts/README.md)
- [../programs/README.md](../programs/README.md)
- [../tests/README.md](../tests/README.md)
