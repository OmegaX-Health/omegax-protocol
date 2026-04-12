# Scripts

Scoped instructions for `scripts/`.

- Start with `../README.md`, `../CONTRIBUTING.md`, and `README.md` in this directory.
- Prefer root `npm run ...` wrappers over invoking individual script files directly when a package script already exists.
- Default to read-only verification or generation flows. Treat bootstrap, deploy, and devnet governance scripts as operator tooling that can mutate on-chain state or depend on ignored local env files; do not run them unless the user explicitly asks.
- Keep repo changes public-safe: no local override env files, deployment aliases, private keys, or validator artifacts in tracked files.
- If you change a script's purpose, arguments, or output contract, update this directory's `README.md` and any nearby operations doc that describes the workflow.
- Validate with the narrowest relevant root command. Use `npm run verify:public` for repo-wide public readiness, and use `npm run test:e2e:localnet` when the localnet harness or public protocol surface changed.
