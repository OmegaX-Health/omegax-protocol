# Certora Solana Security Lane

This directory is the manual Certora Solana lane for the OmegaX on-chain
program. It is intentionally separate from `npm run verify:public`: Certora
runs submit jobs to Certora's remote prover service, require a personal access
key, and are release-candidate evidence rather than normal public CI.

## Setup

Install the local tools:

```bash
pip3 install certora-cli
cargo install cargo-certora-sbf
```

Register for Certora's free personal access key and export it locally:

```bash
export CERTORAKEY=<personal_access_key>
```

Never commit `CERTORAKEY`, prover credentials, private source bundles, generated
job archives, or dashboard-only links that reveal private run material.

## Local Prerequisite Check

Run this from the repository root:

```bash
npm run certora:solana:check
```

The check verifies local prerequisites and the presence of the lane files. It
does not submit a remote job.

## Manual Sanity Run

Only run this when you are comfortable submitting the configured sources and
summaries to Certora's remote service:

```bash
npm run certora:solana:sanity
```

The first committed config is a starter sanity lane. It exists to establish the
repo shape and should be tightened as concrete CVLR rules are added. A passing
run is internal formal-verification evidence; it is not a third-party audit and
must not be described publicly as "Certora audited" unless Certora has actually
performed and published that review.

The npm wrapper temporarily rewrites the local `Cargo.lock` metadata version
from `4` to `3` while Certora builds because the Certora Solana platform-tools
metadata parser does not yet accept lockfile version 4. It restores the file
before exiting and does not change dependency resolution.

## Relationship To QEDGen

QEDGen remains the local brownfield modeling lane for broad handler-surface
coverage. Certora is the narrower symbolic-prover lane for high-value Solana
kernel properties such as fee recipient binding, vault transfer bounds,
selected-asset payout limits, and reserve-capacity arithmetic.
