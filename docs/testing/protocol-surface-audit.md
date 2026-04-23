<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Protocol Surface Audit

This note describes the current heavy localnet audit for the canonical OmegaX health-capital-markets surface.

## Scope

The localnet audit is the heavier release-candidate proof that sits above `npm run verify:public`.

It validates three things against the checked-in contract and canonical fixture state:

- the live instruction surface is fully owned by the canonical scenario manifest
- retired pool-era instructions do not reappear in the live contract
- deterministic reserve, plan, claim, and capital fixtures still line up with the current public model
- the bootstrap-to-operator journey still holds together across governance, launch, oracle, member, claim, and capital actions

## Source of truth

The heavy audit is defined by:

- `scripts/run_localnet_e2e.mjs`
- `e2e/localnet_protocol_surface.test.ts`
- `e2e/support/surface.ts`
- `e2e/support/surface_manifest.ts`

The live public instruction set comes from:

- `shared/protocol_contract.json`
- `idl/omegax_protocol.json`

## Canonical scenario families

The current manifest assigns every live instruction to one scenario family:

- governance and scoped controls
- reserve domain and vault setup
- sponsor-funded plan lifecycle
- reward obligation lifecycle
- protection claim lifecycle
- liquidity pool and capital class lifecycle
- allocation and deallocation lifecycle
- impairment and redemption queue lifecycle

Each family owns a specific subset of instruction names and a matching deterministic fixture assertion path.

The manifest also includes one cross-scenario release-candidate journey:

- `bootstrap_to_self_serve_plan_journey`, a historical scenario name that now verifies the canonical operator-mediated path from protocol bootstrap through launch, oracle onboarding, member enrollment, claim intake, attestation, linked-obligation settlement wiring, LP credentialing, and impairment handling

## What the audit enforces

The heavy audit fails if:

- a live canonical instruction is missing from the scenario manifest
- the manifest names an instruction that is not present in the live contract
- one instruction is assigned to multiple scenario families
- an exception entry is present without a concrete reason
- a retired legacy instruction name appears in the live contract
- the canonical fixture state no longer supports the scenario-family assertions

This keeps the repo honest without pretending that sponsors, claims, and LP capital are still one pool-shaped surface.

## Running it

From the repository root:

```bash
npm run test:e2e:localnet
```

Useful environment variables:

- `OMEGAX_E2E_SKIP_BUILD=1` reuses the current checked build
- `OMEGAX_E2E_KEEP_ARTIFACTS=1` preserves validator logs and the JSON summary
- `OMEGAX_E2E_SCENARIO=<scenario_name>` reruns one canonical scenario family

For the focused operator-mediated release-candidate path:

```bash
OMEGAX_E2E_SCENARIO=bootstrap_to_self_serve_plan_journey npm run test:e2e:localnet
```

The runner writes a timestamped summary under `artifacts/`.

## Summary output

The JSON summary includes:

- selected scenario, if any
- scenario-family metadata
- live vs owned instruction counts
- missing, duplicate, or unexpected ownership entries
- any retired legacy instructions that reappeared
- canonical fixture counts for domains, plans, series, pools, classes, obligations, and claims
- cross-scenario bootstrap and operator-readiness for the mounted canonical console path

## Relationship to the fast gate

`npm run verify:public` remains the fast repository gate.

Use the heavy localnet audit when:

- preparing release candidates or publication points
- changing public instruction ownership or canonical scenario mapping
- changing deterministic devnet fixture structure
- changing reserve, claim, or capital semantics that deserve a stronger proof than unit and Node tests alone
