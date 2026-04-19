# OmegaX Protocol

Public repository. Keep instructions and changes public-safe.

## Scope

- Work within the boundary described in `README.md`, `CONTRIBUTING.md`, and the nearest local `README.md`.
- Do not add secrets, private keys, private endpoints, internal repo references, or machine-specific local paths.
- Private backend services, operator credentials, and production control-plane automation stay out of this repository.

## Repo Layout

- `programs/omegax_protocol/` contains the on-chain program. Pair its local `README.md` with the architecture docs in `docs/architecture/`.
- `frontend/` contains the public Next.js protocol console.
- `tests/` contains the fast Node-based verification suite; `e2e/` contains the heavier localnet protocol-surface matrix.
- `scripts/` contains verification, generation, and operator tooling. Prefer the root `npm run ...` wrappers when they exist.
- `idl/`, `shared/`, and `android-native/protocol/` contain checked-in generated artifacts.

## Working Notes

- Keep changes focused and reviewable.
- Commits intended for this repository must include a DCO sign-off trailer (`Signed-off-by:`). Use `git commit -s` so `Public CI` does not fail at the `Enforce DCO sign-off` step.
- Update the nearest README or operations doc when commands, responsibilities, or reviewer read paths change.
- Add or update tests, docs, and checked-in artifacts when behavior changes.
- Do not hand-edit generated outputs in `idl/`, `shared/`, `frontend/lib/generated/`, or `android-native/protocol/` unless a documented maintenance workflow explicitly requires it.
- If you change the protocol surface or shared protocol builders, regenerate artifacts with `npm run anchor:idl` and `npm run protocol:contract`.

## Genesis Protect Launch Keys

- The prepared public vanity operator wallet is `oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h`.
- Do not commit the private keypair, seed phrase, absolute local keypair path, or funding details to this public repository.
- When intentionally using this wallet as the Genesis live oracle/operator, set `OMEGAX_LIVE_ORACLE_WALLET` to the public key above and provide the private keypair only through the local operator environment via `OMEGAX_LIVE_ORACLE_KEYPAIR_PATH`.
- When intentionally using this wallet as a deploy or governance signer, provide the private keypair only through the local operator environment via `SOLANA_KEYPAIR`.
- Confirm funding and signer role before any mainnet transaction; the vanity wallet was created for launch prep, not automatically authorized or funded.

## Verification

- Run the narrowest relevant checks before finishing.
- Use `npm run verify:public` for the normal repo-wide public validation gate.
- Use `npm run test:node` when protocol builders, generated artifacts, or frontend/server helpers change.
- Use `npm run test:e2e:localnet` for broader protocol-surface changes, harness updates, or release-candidate sign-off.

## Protocol Status

- Treat the current protocol surface as actively evolving during development and devnet work.
- Do not assume the current shape is frozen.
- Do not introduce `v2` names, parallel surfaces, or permanent compatibility layers by default.
- Prefer improving the current surface in place unless a real compatibility constraint requires a separate path.
- Keep `programs/omegax_protocol/src/`, `frontend/lib/protocol.ts`, `shared/protocol_contract.json`, and `idl/omegax_protocol.json` aligned as the current public protocol surface.
- When editing adjacent code, remove stale `v2` wording from labels, docs, tests, and internal locals instead of carrying it forward.

## Definition of Done

- Code, checked-in artifacts, and docs agree on the same public surface.
- Relevant validation passed, or you explicitly noted why a heavier check was not run.
- No secrets, local validator state, deployment-only config, or machine-specific output were added.
