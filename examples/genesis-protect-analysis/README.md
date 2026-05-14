# Genesis Protect Analysis Hub

This is the public-safe index for Genesis Protect simulation, actuarial, and reserve analysis in the protocol repo.

The protocol repo should show enough evidence for builders, reviewers, and investors to understand that Genesis Protect has a working pricing, reserve, and claim-flow model. It should not expose proprietary Health/oracle simulation machinery.

## Canonical Public Artifacts

| Area | Location | Regenerate | Public status |
| --- | --- | --- | --- |
| Fixed SKU launch gates | `../genesis-protect-acute-actuarial-review/` | `npm run genesis:actuarial:review` | Public-safe |
| Curve and market-structure PoC | `../nomad-protect-curve-poc/` | `npm run nomad:curve:poc` | Public-safe experimental |
| Public claim fixtures | `../genesis-protect-acute-claims/` | Manual fixture curation | Public-safe examples |
| Health claim-simulator summary | `./health-claim-simulation-public-summary.json` | Export aggregate-only from Health | Public-safe aggregate |

## Public-Safe Story

Genesis Protect analysis is split into four layers:

1. Product truth: SKU prices, caps, waiting periods, reserve lanes, and launch gates live in public protocol metadata.
2. Actuarial launch gate: deterministic workbook checks baseline, adverse, correlated, LP-exit, and claims-ops gates.
3. Product exploration: curve and market-structure PoCs test future products without changing Genesis v1 pricing.
4. Claim realism: detailed case generation stays in OmegaX Health; protocol receives only aggregate summaries and curated public fixtures.

## What Belongs Here

- Public-safe assumptions and scenario matrices.
- Generated workbook outputs and human-readable memos.
- Aggregate Health simulation summaries with counts, hashes, and high-level findings.
- Curated example claim fixtures that do not reveal internal synthetic-user generation logic.
- Clear disclaimers that these are planning artifacts, not external actuarial, legal, regulatory, or underwriting opinions.

## What Does Not Belong Here

- Raw Health `.cases.jsonl` exports.
- Full synthetic user profiles.
- Health scenario-pack archetypes or adversarial generation details.
- Health-agent samples, devnet sentinel samples, private operator workflow traces, or private backend endpoints.
- Machine-specific local paths, secrets, private key material, or production control-plane notes.

## Commands

From the protocol repo root:

```sh
npm run genesis:actuarial:review
npm run nomad:curve:poc
```

The fixed SKU workbook validates against public Genesis metadata before writing outputs. The curve PoC is explicitly experimental and does not replace Genesis Protect Acute v1 pricing.

## Current Read Order

1. `../genesis-protect-acute-actuarial-review/README.md`
2. `../genesis-protect-acute-actuarial-review/review-memo.md`
3. `../genesis-protect-acute-claims/README.md`
4. `health-claim-simulation-public-summary.json`
5. `../nomad-protect-curve-poc/README.md`
6. `../nomad-protect-curve-poc/hybrid-model-report.md`

## Local-Only Internal Diligence

More detailed internal diligence may exist locally under `.superstack/`. That folder is ignored and should not be pushed unless a specific artifact is rewritten into public-safe form first.
