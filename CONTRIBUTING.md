# Contributing to OmegaX Protocol

Thanks for helping improve OmegaX Protocol.

## License and contribution terms

- This repository is licensed under `AGPL-3.0-or-later`.
- Contributions are accepted on an inbound=outbound basis: by submitting a contribution, you agree that your contribution is licensed under the repository's `AGPL-3.0-or-later` license.
- This project uses the Developer Certificate of Origin (DCO).
- We do **not** require a CLA for normal contributions.
- Contributors retain copyright in their own work unless they explicitly assign it elsewhere.
- Public notices and repository metadata may describe this project as maintained by `OMEGAX HEALTH FZCO and contributors`.

Every commit must include a `Signed-off-by` trailer:

```bash
git commit -s
```

Example:

```text
Signed-off-by: Your Name <you@example.com>
```

## Development setup

```bash
npm ci
npm --prefix frontend ci
```

Useful commands:
- `npm run rust:fmt:check`
- `npm run rust:test`
- `npm run rust:lint`
- `npm run test:node`
- `npm run frontend:build`
- `npm run verify:public`
- `npm run protocol:contract:check`
- `npm run public:hygiene:check`
- `npm run license:audit`

## Repository areas

- `programs/` contains on-chain protocol code
- `frontend/` contains the public protocol console
- `scripts/` contains verification, generation, and operator tooling
- `tests/` contains the public Node-based test suite
- `e2e/` contains the heavier localnet protocol-surface matrix
- `docs/` contains public architecture, reference, and operations docs

If you are new to the repository, start with:
- `README.md`
- `docs/README.md`
- the local README in the directory you plan to change

## Pull request expectations

- Keep changes focused and reviewable.
- Add or update tests for behavior changes.
- Keep the public release gate green: `npm run verify:public`.
- Use `npm run test:e2e:localnet` as an additional sign-off step for public release candidates or broad protocol-surface validation.
- Do not commit secrets, private keys, local validator data, or deployment-only config.
- Keep public documentation and templates aligned with code changes.
- Preserve the visible in-app source/legal links for hosted frontend builds.
- Update directory README files when changing structure or responsibilities in a meaningful way.
- If you change the on-chain protocol surface, update the Solana architecture/instruction docs.
- If a change has downstream follow-up outside this repo, note it briefly in the PR summary without treating it as part of the public release gate.

## Scope boundaries

- Protocol, frontend, and checked-in source artifacts belong here.
- Private backend services, operator credentials, and deployment-only secrets do not.
- SDK-specific changes should land in `omegax-sdk` unless they are strictly protocol-artifact sync updates.
