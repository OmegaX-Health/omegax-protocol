# Italian Rehab and Full-Cover Research Product

This folder contains a non-canonical research/example product set re-homed from
Manuel's public PR work so the contribution remains visible without changing the
current OmegaX launch truth.

Important boundaries:

- This is protocol-compatible example material, not canonical devnet bootstrap
  truth.
- This is not part of Genesis Protect Acute v1 launch scope, pricing, or public
  positioning.
- Shared-devnet bootstrap, frontend parity, and release sign-off flows must
  ignore this folder.
- The canonical fixture graph remains under `devnet/` and
  `frontend/lib/devnet-fixtures.ts`.

Contents:

- `research-example-manifest.json` — summary manifest for the example set
- `italy-thr-rehab-model.json` — total hip replacement rehab actuarial model
- `italy-tkr-rehab-model.json` — total knee replacement rehab actuarial model
- `italy-rsp-rehab-model.json` — reverse shoulder prosthesis rehab actuarial model
- `italy-stroke-rehab-model.json` — post-stroke neurorehabilitation actuarial model
- `fullcover-working-adults-model.json` — broad annual private-health example model

This copy also includes two coherence fixes for the full-cover example:

- tier module lists match the modules declared in `includedInTiers`
- per-event catastrophic caps stay distinct from the annual Gold cap wording
