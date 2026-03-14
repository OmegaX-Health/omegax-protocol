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
- faucet and captcha secrets must not be committed
- runtime-only hosting values should use Secret Manager references in `frontend/apphosting.yaml`
- `NEXT_PUBLIC_SOURCE_REPO_URL` should point at the exact public source repository or release used by the hosted deployment

## Deployment boundary

This repo contains the public frontend source, but not private hosting credentials or service-side secret management. Hosted deployments should inject runtime-only secrets through the hosting provider rather than storing them in git. Use [docs/operations/firebase-app-hosting-cutover.md](../docs/operations/firebase-app-hosting-cutover.md) when wiring a GitHub-connected Firebase App Hosting backend.
