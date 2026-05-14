# Genesis Protect Analysis Hub

## Scope

This folder is the public-safe protocol index for Genesis Protect actuarial, claim-fixture, and risk-model evidence.

## Rules

- Keep this folder public-safe. The `omegax-protocol` repo is public.
- Do not copy raw Health claim simulation JSONL, synthetic user profiles, scenario-pack internals, health-agent samples, private backend details, or machine-local paths into this repo.
- Show proof through aggregate summaries, generated public workbooks, curated fixtures, and reproducible commands.
- Keep Genesis v1 fixed-SKU analysis separate from future curve or market-structure experiments.
- If a claim depends on local-only `.superstack/` diligence, either cite it as local-only or rewrite the artifact into public-safe form before tracking it.

## Validation

- Run `npm run genesis:actuarial:review` after changing fixed-SKU assumptions or review docs.
- Run `npm run nomad:curve:poc` after changing curve PoC assumptions or docs.
- Run `git diff --check` before committing.
- Protocol commits require DCO sign-off.
