# OmegaX Protocol

Public repository. Keep instructions and changes public-safe.

## Scope

- Work within the boundary described in `README.md` and `CONTRIBUTING.md`.
- Do not add secrets, private keys, private endpoints, internal repo references, or machine-specific local paths.
- Private backend services, operator credentials, and production control-plane automation stay out of this repository.

## Working Notes

- Start with `README.md`, `CONTRIBUTING.md`, and the local `README.md` for the area you are changing.
- Keep changes focused and reviewable.
- Add or update tests, docs, and checked-in artifacts when behavior changes.
- Run the relevant checks before finishing. Use `npm run verify:public` for normal repo validation and `npm run test:e2e:localnet` for broader protocol-surface validation when needed.

## Protocol Status

- Treat the current protocol surface as actively evolving during development and devnet work.
- Do not assume the current shape is frozen.
- Do not introduce `v2` names, parallel surfaces, or permanent compatibility layers by default.
- Prefer improving the current surface in place unless a real compatibility constraint requires a separate path.
- Use the current canonical surface in `frontend/lib/protocol.ts`, `shared/protocol_contract.json`, and `idl/omegax_protocol.json` as the working source of truth.
- When editing adjacent code, remove stale `v2` wording from labels, docs, tests, and internal locals instead of carrying it forward.
