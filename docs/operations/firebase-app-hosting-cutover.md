# Firebase App Hosting Cutover

This runbook covers the safe way to move the existing protocol App Hosting backend onto the public `omegax-protocol` repo.

## Goal

Reuse the existing Firebase App Hosting backend `omegax-health-protocol` in project `omegax-health` while making this public repo the deployment source of truth.

Use a checked-in repo-root `firebase.json` plus `frontend/apphosting.yaml` so that:

- local-source deployments can target the existing backend from this repo
- the hosted app keeps pointing at the public GitHub source it was built from
- no local Firebase project aliases or deployment-only overrides are committed

## Files

- `firebase.json` is the checked-in App Hosting deployment map for this repo
- `frontend/apphosting.yaml` is the public-safe config tracked in git
- `frontend/.env.example` is the local developer template
- `frontend/apphosting.local.yaml` is optional for private local experiments and must stay untracked
- `.firebaserc` is local-only and must stay untracked

## What Is Safe To Commit

- App Hosting backend IDs and `rootDir` values in `firebase.json`
- Solana program IDs
- public on-chain addresses
- public explorer cluster and public repo URL

## What Must Stay Outside Git

- `.firebaserc`
- Firebase local state under `.firebase/`
- any local or environment-specific private overrides

## Backend Strategy

Use the existing backend and domain wiring instead of creating a parallel backend.

Firebase supports this in two stages:

1. Use local-source deployment from this repo to roll out the existing backend.
2. Reconnect the same backend’s Deployment settings to the public GitHub repo after the local rollout is verified.

This avoids disturbing the backend ID, hosted URL, or custom domain binding during the cutover.

## Current Deployment Shape

- Firebase project: `omegax-health`
- Backend ID: `omegax-health-protocol`
- App root directory: `frontend/`
- Live branch after reconnect: `main`

## Rollout Steps

1. Confirm `frontend/apphosting.yaml` contains only public runtime configuration.
2. Confirm `.firebaserc`, `.firebase/`, `frontend/.env.local`, and any `apphosting.local.yaml` files are ignored.
3. Run the local-source rollout from the repo root:

   ```bash
   firebase deploy --project omegax-health --only apphosting:omegax-health-protocol
   ```

4. Verify both:
   - `https://omegax-health-protocol--omegax-health.us-east4.hosted.app`
   - `https://protocol.omegax.health`
5. Confirm the live app footer points at `https://github.com/OmegaX-Health/omegax-protocol`.
6. In Firebase console, open `omegax-health` -> App Hosting -> `omegax-health-protocol` -> `Settings` -> `Deployment`.
7. Connect the backend to `OmegaX-Health/omegax-protocol`.
8. Set the root directory to `frontend/`.
9. Set the live branch to `main`.
10. Leave automatic rollouts disabled until one manual GitHub rollout succeeds.
11. Trigger a manual rollout from the backend’s Rollouts view and verify the same URLs again.

## Rollout Checklist

1. The repo root contains `firebase.json` with `backendId: omegax-health-protocol` and `rootDir: frontend`.
2. The deployed app loads without any faucet or captcha flow.
3. Governance and core protocol views render successfully.
4. The hosted footer/source links resolve to the public repo.
5. The live backend is no longer dependent on the legacy private-repo deployment path.

## Notes

- `NEXT_PUBLIC_*` values are browser-visible by design.
- `frontend/apphosting.yaml` is the canonical public config for browser-safe runtime values.
- If runtime-only server values are added in the future, use Secret Manager references in `apphosting.yaml` or backend settings instead of committing plaintext values.
