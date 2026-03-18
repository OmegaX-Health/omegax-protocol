# Frontend

This directory contains the Next.js protocol console for OmegaX Protocol.

## Responsibilities

- render the public protocol console
- expose protocol state, pool operations, governance views, and operator workflows
- provide source and legal links for hosted AGPL deployments
- keep client-visible configuration separated from runtime-only secrets

## Key directories

- `app/` contains routes, layouts, and API handlers
- `components/` contains reusable interface and workflow components
- `lib/` contains protocol-facing helpers, metadata utilities, and server-side helpers
- `public/` contains static assets intended for redistribution

## Commands

```bash
npm --prefix frontend ci
npm --prefix frontend run dev
npm --prefix frontend run build
```

## Environment

Start from:
- `frontend/.env.example`
- `frontend/apphosting.yaml`

Rules:
- `NEXT_PUBLIC_*` values are treated as public runtime configuration
- repo-root `firebase.json` wires local App Hosting deploys to the existing protocol backend
- `.firebaserc` must stay local and untracked in this public repo
- if runtime-only hosting values are added later, use Secret Manager references in `frontend/apphosting.yaml`
- `NEXT_PUBLIC_SOURCE_REPO_URL` should point at the exact public source repository or release used by the hosted deployment
- devnet parity bootstrap can also read ignored local override env files or a `DEVNET_FRONTEND_BOOTSTRAP_ENV_FILE` when operator-only values must stay out of tracked files

## Deployment boundary

This repo contains the public frontend source and checked-in App Hosting deployment wiring, but not local Firebase project aliases or deployment-only overrides. Use [docs/operations/firebase-app-hosting-cutover.md](../docs/operations/firebase-app-hosting-cutover.md) when wiring the existing Firebase App Hosting backend to this public repo.
