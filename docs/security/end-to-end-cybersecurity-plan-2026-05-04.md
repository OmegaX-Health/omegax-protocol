# End-to-End Cybersecurity Plan - 2026-05-04

## Scope

This plan covers the public OmegaX Protocol repository: the Anchor program,
frontend transaction builders, operator scripts, generated protocol artifacts,
CI/CD, dependency gates, and devnet/localnet proof harnesses.

Out of scope: mainnet transactions, private-key discovery, real-fund movement,
private backend services, and production operator credentials.

## Security Model

Primary assets:

- SPL reserve custody in `DomainAssetVault` token accounts.
- Reserve/accounting ledgers: domain, plan, series, funding line, pool class,
  allocation, fee vault, claim, obligation, and commitment state.
- Privileged role keys: governance, plan admin, claims operator, oracle,
  curator, allocator, sentinel, and bootstrap signers.
- Generated interface truth: `idl/`, `shared/protocol_contract.json`, and
  `frontend/lib/protocol.ts`.

Main trust boundaries:

- Browser or operator script -> wallet signer -> Solana RPC.
- Frontend transaction builders -> Anchor account metas and instruction args.
- Claims/oracle operator workflow -> on-chain hashes, attestations, and
  settlement instructions.
- Dependency and CI inputs -> generated artifacts and release-candidate
  evidence.

## Black-Hat Goals To Defend

- Drain or redirect vault custody through malformed settlement, redemption, or
  fee-withdraw transactions.
- Book a liability as settled without moving SPL custody.
- Overbook reserve capacity so later claims, redemptions, or LP accounting
  silently become insolvent.
- Allocate LP capital across mismatched assets and hide the loss in scoped
  ledgers.
- Use a broad pool role such as sentinel or allocator to mutate oracle policy,
  fee economics, or capital-class controls.
- Change a claim payout recipient after approval.
- Activate canceled, paused, expired, or refund-eligible commitments.
- Make an operator sign a valid but dangerous transaction because the pre-sign
  review omitted authority, amount, recipient, or target-account details.
- Ship stale IDL/contract artifacts or dependency advisories under a green
  baseline gate.

## Hard Invariants

Implemented and regression-tested in this pass:

- Claim recipients are locked once the claim is approved or any payout exists.
- LP allocation funding lines must use the pool deposit mint in v1.
- Allocation and reserve booking must have free capacity in the relevant
  source: pool-class redeemable capacity for allocation, and funding-line or
  LP-allocation free capacity for obligation reserve booking.
- Commitment activation requires an active campaign, active payment rail, and a
  non-expired campaign window.
- `settle_obligation` cannot mark an asset-backed obligation settled without
  SPL outflow accounts. Linked claims pay the resolved member/delegate
  recipient; unlinked settlements can only pay the authority-owned recipient
  token account.
- Pool oracle policy/permission and capital-class control paths require curator
  or governance authority. Allocation paths require allocator, curator, or
  governance authority; sentinel is not an economic mutation role.
- Token-2022 remains unsupported by v1 custody rails.

Still required before any production-promotion claim:

- Full localnet round trips for fee-vault init/accrue/withdraw across protocol,
  pool treasury, and pool oracle fee rails.
- Devnet canary states for protocol fee vault, pool treasury vault, pool oracle
  fee vault, pending LP redemption, and LP-allocation obligation. The linked
  claim canary has been seeded and is covered by
  `docs/security/devnet-treasury-pen-test-2026-05-04.md`.
- A fresh devnet treasury pen-test report with zero skipped probes or explicit
  accepted-risk explanations.
- Release-candidate evidence with CI run IDs, localnet E2E output, SBOM,
  dependency-advisory state, branch protection, operator-script guard output,
  and external-audit/bug-bounty posture.

## Verification Commands

Baseline repo health:

```bash
npm run anchor:idl
npm run protocol:contract
npm run rust:fmt:check
npm run rust:test
npm run rust:lint
npm run test:node
npm run frontend:build
npm run license:audit
npm run security:audit:deps
npm run security:sbom
npm run verify:public
```

Protocol-surface release evidence:

```bash
npm run test:e2e:localnet
npm run devnet:operator:drawer:sim
npm run devnet:treasury:pen-test
```

Notes:

- `npm run verify:public` is necessary but not sufficient for production
  promotion.
- Mainnet remains blocked until the release-candidate evidence template is
  complete and the mainnet bootstrap guard confirms distinct privileged roles.
- The devnet treasury pen-test is simulate-first and should not move funds.

## Evidence Pointers

- Prior historical report: `docs/security/pre-mainnet-pen-test-2026-04-27.md`
- Fresh adversarial report: `docs/security/codex-challenge-2026-04-29.md`
- Devnet treasury simulation: `docs/security/devnet-treasury-pen-test-2026-05-04.md`
- Zero-day follow-up: `docs/security/zero-day-hunt-2026-05-04.md`
- Role custody policy: `docs/security/mainnet-privileged-role-controls.md`
- Production gate: `docs/operations/release-candidate-evidence-template.md`
