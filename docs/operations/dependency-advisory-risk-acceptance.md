# Dependency Advisory Risk Acceptance

Last reviewed: 2026-04-27

This note records production dependency advisories that remain after the CSO remediation pass.
It is intentionally narrow: only advisories still reported by `npm audit --omit=dev` after compatible
upgrades and overrides are listed here.

## Current Accepted Advisory

### `bigint-buffer` via Solana SPL Token

- Severity reported by npm: high
- Advisory: `GHSA-3gc7-fjrx-p6mg`
- Affected path: `@solana/spl-token` -> `@solana/buffer-layout-utils` -> `bigint-buffer`
- Current root and frontend audit state: `3 high severity vulnerabilities`, all under this path
- npm suggested remediation: `npm audit fix --force`, which installs `@solana/spl-token@0.1.8`

We are not applying the forced remediation because it downgrades the SPL Token package across a
major public protocol surface and would invalidate current builders, frontend transaction assembly,
and operator scripts that rely on the current `@solana/spl-token@0.4.x` API shape.

Current reachability:

- The public console and scripts use SPL Token helpers for token program IDs, associated token
  accounts, mint reads, governance token setup, and protocol transaction construction.
- The repository does not expose a server-side API that parses arbitrary attacker-supplied binary
  token layouts through this package.
- The highest-risk path is client/operator transaction construction and RPC decoding. Keep the
  dependency current and avoid adding server-side parsing of untrusted token-account buffers through
  this package without a separate review.

Acceptance conditions:

- Keep `@solana/spl-token`, `@solana/web3.js`, and Solana wallet packages on the newest compatible
  published releases.
- Do not use `npm audit fix --force` if it proposes downgrading SPL Token or Web3.js.
- Revisit this file when a patched SPL Token or buffer-layout-utils release is available, or when
  this repository starts exposing backend parsing surfaces for untrusted token buffers.

## Remediated In This Pass

- Root and frontend `uuid` advisory paths are overridden to `uuid@14.0.0`.
- Frontend framework stack was upgraded to `next@16.2.4`, `react@19.2.5`, and `react-dom@19.2.5`.
- Frontend transitive advisories for `axios`, `brace-expansion`, `follow-redirects`, `minimatch`,
  `picomatch`, `postcss`, and `yaml` are pinned or overridden to patched versions.
