# Dependency Advisory Risk Acceptance

Last reviewed: 2026-05-04

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
- Keep `npm run security:audit:deps` in CI so this file is the only accepted-advisory allowlist.
- Revisit this file when a patched SPL Token or buffer-layout-utils release is available, or when
  this repository starts exposing backend parsing surfaces for untrusted token buffers.

### RustSec warnings through Anchor/Solana

- Current local `cargo audit` state: 6 warnings, all transitive through Anchor/Solana crates
- Current `cargo deny` policy: advisories are checked in CI; `unmaintained` and `unsound` fail for
  workspace-owned crates while current transitive Solana/Anchor warnings remain accepted; yanked
  crates warn while bans and source provenance remain enforced
- Observed advisories:
  - `RUSTSEC-2025-0141` (`bincode` unmaintained)
  - `RUSTSEC-2025-0161` (`libsecp256k1` unmaintained)
  - `RUSTSEC-2026-0012` (`keccak` ARMv8 backend unsoundness, plus yanked crate warning)
  - `RUSTSEC-2026-0097` (`rand` unsoundness in custom-logger edge case)

We are not replacing these directly because they enter through the Solana/Anchor dependency tree.
The protocol should continue to pin and upgrade Anchor/Solana-compatible releases quickly; direct use
of these crates in protocol code requires a separate review.

## Remediated In This Pass

- Root and frontend `uuid` advisory paths are overridden to `uuid@14.0.0`.
- Frontend framework stack was upgraded to `next@16.2.4`, `react@19.2.5`, and `react-dom@19.2.5`.
- Frontend transitive advisories for `axios`, `brace-expansion`, `follow-redirects`, `minimatch`,
  `picomatch`, `postcss`, and `yaml` are pinned or overridden to patched versions.
