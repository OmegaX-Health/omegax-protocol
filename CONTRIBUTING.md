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
make dev      # installs root + frontend deps and runs the doctor
make verify   # runs the full public verification gate (verify:public)
make help     # lists every wrapped command
```

`make dev` and `make verify` are thin wrappers around the canonical npm scripts. The full set is also runnable directly:

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
- `npm run idl:freshness:check`
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
- PRs that touch `programs/`, `idl/`, `shared/`, `frontend/lib/protocol.ts`, `frontend/lib/protocol-action.ts`, or `e2e/` automatically trigger the [Localnet E2E workflow](.github/workflows/localnet-e2e.yml). It runs `npm run test:e2e:localnet` against a fresh local validator. First run is ~15-30 min (Solana CLI + Anchor install); subsequent runs reuse cached toolchains.
- For local pre-flight on the same PRs, run `npm run test:e2e:localnet` before pushing — the public release gate doc lists the canonical sequence.
- Do not commit secrets, private keys, local validator data, or deployment-only config.
- Keep public documentation and templates aligned with code changes.
- Preserve the visible in-app source/legal links for hosted frontend builds.
- Update directory README files when changing structure or responsibilities in a meaningful way.
- If you change the on-chain protocol surface, update the Solana architecture/instruction docs.
- If a change has downstream follow-up outside this repo, note it briefly in the PR summary without treating it as part of the public release gate.

## Dependency version policy

- **Caret (`^x.y.z`) for normal runtime and dev dependencies.** Default to caret in `package.json` `dependencies` and `devDependencies` so security patches land via `npm install` without a manual bump. The lockfile (checked in) pins the exact resolved version, so reproducible installs come from `npm ci` regardless of the range syntax.
- **Exact pin (`x.y.z`, no caret) only in `overrides` for security-sensitive transitive deps.** When upstream ships a CVE-fix in a transitive dependency, pin the exact patched version in `frontend/package.json::overrides` so the override does not float into a regression. Document the reason inline if the pin is non-obvious.
- **Cargo crates: caret is the default.** `Cargo.toml` already uses `version = "x.y.z"` style; treat that as caret-compatible per cargo defaults. Anchor and Solana SDK crate versions stay aligned across `programs/omegax_protocol/Cargo.toml` and `Anchor.toml`.
- **Lockfiles are the canonical reproducibility surface.** `package-lock.json`, `frontend/package-lock.json`, and `Cargo.lock` are checked in. Don't run `npm install --no-save` in CI; always use `npm ci`.

When upgrading a major version of a runtime dep (e.g. `@solana/web3.js` v1 → v2), open a dedicated PR — bundling major bumps with feature work makes regressions hard to bisect.

## Scope boundaries

- Protocol, frontend, and checked-in source artifacts belong here.
- Private backend services, operator credentials, and deployment-only secrets do not.
- SDK-specific changes should land in `omegax-sdk` unless they are strictly protocol-artifact sync updates.
