# Release-Candidate Evidence Template

> **What this is**: a fillable snapshot of the evidence backing a single release-candidate at the moment it was assembled. **`npm run verify:public` is the repo baseline health gate; this template is the production-approval gate.** Promotion to a public tag, mainnet seeding, or any live-cluster surface requires every section below to be filled in truthfully — empty sections are blockers, not formalities.
>
> Copy this file to `docs/operations/release-vX.Y.Z-evidence.md` (or attach it to the release notes / PR description) when assembling a release-candidate. Leave the prose in place; replace the angle-bracket placeholders.

## How to fill this in

Each section lists the exact command(s) that produce its output. Run them locally on the candidate commit, paste the result, and add the maintainer judgment line. Where a command writes a JSON or log artifact under `artifacts/`, link to the file in this PR or release notes — do not paste large logs inline.

Use [`commands.sh`](#commands) at the bottom of this template as a one-shot script if you want to regenerate every artifact in a known order.

---

## 1. Identity

| Field | Value |
|-------|-------|
| Release tag | `<v0.3.2>` |
| Commit SHA | `<full 40-char SHA>` |
| Branch (where assembled) | `<main / release/0.3.2 / etc.>` |
| Date assembled (UTC) | `<YYYY-MM-DDThh:mm:ssZ>` |
| Maintainer | `<name + DCO email>` |

## 2. Generated artifact hashes

Hash the checked-in generated artifacts at this commit. Drift between any of these and what the tooling would regenerate is a blocker.

```bash
# at the candidate commit, with the toolchain installed
shasum -a 256 \
  idl/omegax_protocol.json \
  idl/omegax_protocol.source-hash \
  shared/protocol_contract.json \
  frontend/lib/generated/protocol-contract.ts \
  frontend/lib/generated/protocol-contract.js
```

| Artifact | SHA-256 |
|----------|---------|
| `idl/omegax_protocol.json` | `<sha256>` |
| `idl/omegax_protocol.source-hash` (value, not file hash) | `<the hex hash inside the file>` |
| `shared/protocol_contract.json` | `<sha256>` |
| `frontend/lib/generated/protocol-contract.ts` | `<sha256>` |
| `frontend/lib/generated/protocol-contract.js` | `<sha256>` |

| Drift gate | Result |
|------------|--------|
| `npm run idl:freshness:check` | `<PASS / FAIL>` |
| `npm run protocol:contract:check` | `<PASS / FAIL>` |

If either gate is FAIL, this release-candidate is invalid — regenerate, recommit, and re-assemble this evidence file from the new tip.

## 3. CI evidence

The release-candidate commit must have green CI on the canonical workflows.

| Workflow | Run URL | Run ID | Conclusion | Duration |
|----------|---------|--------|------------|----------|
| Public CI (`ci.yml`) | `<https://github.com/.../runs/...>` | `<run id>` | `<success>` | `<MM:SS>` |
| Localnet E2E (`localnet-e2e.yml`) | `<https://github.com/.../runs/...>` | `<run id>` | `<success>` | `<MM:SS>` |

| Required-status check posture | Value |
|------|------|
| All required status checks pass on this SHA | `<yes / no>` |
| Workflows triggered as expected (path filters) | `<yes / no — explain>` |
| Any flaky retries | `<count + brief note>` |

## 4. Branch protection state

```bash
gh api repos/OmegaX-Health/omegax-protocol/branches/main/protection
```

| Setting | Expected | Actual |
|---------|----------|--------|
| Branch protection enabled on `main` | yes | `<yes / no>` |
| Required PR review approvals | `>= 1` | `<n>` |
| Stale review dismissal | yes | `<yes / no>` |
| Required status checks | `verify` (and `localnet-e2e` if path-filter applies) | `<list>` |
| Strict (up-to-date) status checks | yes | `<yes / no>` |
| Admin enforcement | yes | `<yes / no>` |
| Force pushes blocked | yes | `<yes / no>` |
| Branch deletion blocked | yes | `<yes / no>` |

If any expected setting is missing, fix the rule before promotion.

## 5. Local validation lanes

Each lane is a separate evidence point. Run them on the candidate commit in a clean clone.

| Lane | Command | Exit code | Artifact |
|------|---------|-----------|----------|
| Repo baseline health | `npm run verify:public` | `<0>` | n/a |
| Localnet protocol-surface audit | `OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet` | `<0>` | `<artifacts/localnet-e2e-summary-*.json>` |
| Operator drawer simulation | `npm run devnet:operator:drawer:sim` | `<0>` | `<simulate-only output, none on disk>` |

## 6. Dependency scan

```bash
npm run license:audit
```

| Field | Value |
|-------|-------|
| `license:audit` exit code | `<0>` |
| Root npm production dep count | `<n>` |
| Frontend npm production dep count | `<n>` |
| Cargo dep count | `<n>` |
| Accepted advisories | `<link to docs/operations/dependency-advisory-risk-acceptance.md or "none">` |
| Recent CVE additions since last release-candidate | `<list or "none">` |

## 7. Actuarial gate (Genesis Protect Acute only)

| Field | Value |
|-------|-------|
| Actuarial review state | `<pass / fail / not applicable>` |
| Source | `<link to scripts/genesis_actuarial_review.ts run output, or to the Notion review page>` |
| Reviewer | `<name + date>` |

If the release-candidate touches plan economics, premium tables, capital-class waterfalls, or claim payout caps, this section is required, not optional.

## 8. External audit / bug bounty posture

State this truthfully — under-promising is fine, over-promising is the failure mode this section exists to prevent.

| Field | Value |
|-------|-------|
| External audit completed for this release | `<yes — vendor + report URL / no — explicit "no external audit conducted" / scheduled — vendor + date>` |
| Bug bounty program in place | `<yes — program URL / no>` |
| Date of most recent third-party security review | `<YYYY-MM-DD or "none">` |
| Most recent pen-test report (in-repo) | `<docs/security/pre-mainnet-pen-test-YYYY-MM-DD.md or other>` |
| Outstanding HIGH/CRITICAL pen-test findings | `<list or "none — see findings table in pen-test report">` |

If "no external audit conducted", this **must** be stated in any public messaging that accompanies the release.

## 9. Public posture cross-check

| Claim that must match the truth | Verified |
|---------------------------------|----------|
| `verify:public` is described as repo baseline health, not production approval | `<yes / no>` |
| Public docs do not claim audited or fully decentralized when they are not | `<yes / no>` |
| Operator-mediated paths are labelled as such in the console | `<yes / no>` |
| Phase-0 claims trust posture is described accurately (AI-assisted under operator oversight; not fully AI-led / not fully decentralized) | `<yes / no>` |

## 10. Sign-off

```text
I have verified each section above on the candidate commit and accept this
evidence as sufficient for the proposed promotion. Where a section is "no"
or empty, the corresponding promotion is held until that gap is closed.

Signed-off-by: <Name> <email>
Date: <YYYY-MM-DD>
```

---

## Commands

A one-shot script to regenerate the inputs to this template. Paste the outputs into the corresponding sections.

```bash
# 1. identity
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
date -u +%Y-%m-%dT%H:%M:%SZ

# 2. artifact hashes
shasum -a 256 \
  idl/omegax_protocol.json \
  idl/omegax_protocol.source-hash \
  shared/protocol_contract.json \
  frontend/lib/generated/protocol-contract.ts \
  frontend/lib/generated/protocol-contract.js
head -1 idl/omegax_protocol.source-hash
npm run idl:freshness:check
npm run protocol:contract:check

# 3. CI evidence (replace 18 with the relevant PR number, or omit --pr for the
#    latest run on the branch)
gh pr checks 18 --json state,statusCheckRollup
gh run list --workflow=ci.yml --branch <branch> --limit 1
gh run list --workflow=localnet-e2e.yml --branch <branch> --limit 1

# 4. branch protection
gh api repos/OmegaX-Health/omegax-protocol/branches/main/protection

# 5. local validation
npm run verify:public
OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet
npm run devnet:operator:drawer:sim

# 6. dependency scan
npm run license:audit
cat docs/operations/dependency-advisory-risk-acceptance.md | head -20

# 7. actuarial (only when applicable)
npm run genesis:actuarial:review

# 8. external audit / bug bounty status
ls docs/security/
```
